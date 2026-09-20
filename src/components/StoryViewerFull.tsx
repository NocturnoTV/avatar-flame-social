import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Send, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

export type StoryOverlay = {
  id: string;
  type: "text" | "emoji";
  content: string;
  x: number;
  y: number;
  color?: string;
  font?: "sans" | "serif" | "mono" | "display";
  scale?: number;
  rotation?: number;
};

const OVERLAY_FONT_CLASS: Record<NonNullable<StoryOverlay["font"]>, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
  display: "font-black italic",
};
export type StoryRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  thumbnail_path: string | null;
  caption: string | null;
  created_at: string;
  sound_id?: string | null;
  metadata: { overlays?: StoryOverlay[] } | null;
};
export type StoryUserGroup = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  stories: StoryRow[];
};

const QUICK_REACTIONS = ["😊", "😂", "😍", "😮", "😢", "🔥"];
const STORY_DURATION_MS = 5000;

/** Full-screen Story viewer: per-story progress segments, tap/swipe/hold
 * navigation, video autoplay+mute, quick reactions, a reply box that lands
 * as a normal DM, and (for your own story) a viewers list and delete. */
export function StoryViewerFull({
  groups,
  startGroupIndex,
  startStoryIndex = 0,
  onClose,
  onChanged,
}: {
  groups: StoryUserGroup[];
  startGroupIndex: number;
  startStoryIndex?: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const navigate = useNavigate();
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(startStoryIndex);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundRef = useRef<HTMLAudioElement>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Locks the page behind this full-screen viewer so swiping between
  // stories can never rubber-band-scroll the page underneath.
  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwn = story?.user_id === user?.id;
  const url = useSignedUrl(story?.media_url);

  const storySound = useQuery({
    queryKey: ["story-sound", story?.sound_id],
    enabled: !!story?.sound_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("sounds")
        .select("storage_path")
        .eq("id", story!.sound_id!)
        .maybeSingle();
      return data;
    },
  });
  const soundUrl = useSignedUrl(storySound.data?.storage_path);

  // Restart the attached sound from the top for every story - otherwise it
  // would keep playing wherever it left off from the previous one.
  useEffect(() => {
    const audio = soundRef.current;
    if (!audio || !soundUrl) return;
    audio.currentTime = 0;
    if (!paused) void audio.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, soundUrl]);

  useEffect(() => {
    const audio = soundRef.current;
    if (!audio || !soundUrl) return;
    if (paused) audio.pause();
    else void audio.play();
  }, [paused, soundUrl]);

  const close = () => {
    setMenuOpen(false);
    setViewersOpen(false);
    onClose();
  };

  function goToStory(nextGroup: number, nextStory: number) {
    if (nextGroup < 0) return;
    if (nextGroup >= groups.length) {
      close();
      return;
    }
    const g = groups[nextGroup];
    if (!g) return close();
    if (nextStory < 0) {
      goToStory(nextGroup - 1, (groups[nextGroup - 1]?.stories.length ?? 1) - 1);
      return;
    }
    if (nextStory >= g.stories.length) {
      goToStory(nextGroup + 1, 0);
      return;
    }
    setGroupIndex(nextGroup);
    setStoryIndex(nextStory);
    setProgress(0);
    setMenuOpen(false);
    setViewersOpen(false);
  }

  function next() {
    if (!group) return;
    goToStory(groupIndex, storyIndex + 1);
  }
  function prev() {
    goToStory(groupIndex, storyIndex - 1);
  }

  // Progress/auto-advance - video stories drive it off real playback time,
  // image stories use a fixed timer.
  useEffect(() => {
    if (!story || paused) return;
    if (story.media_type === "video") return;
    const start = Date.now() - progress * STORY_DURATION_MS;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) {
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || story?.media_type !== "video") return;
    if (paused) video.pause();
    else void video.play();
  }, [paused, story?.media_type]);

  // Record a view once per story.
  useEffect(() => {
    if (!story || !user || isOwn) return;
    void supabase.from("story_views").upsert({ story_id: story.id, user_id: user.id });
  }, [story?.id, user, isOwn]);

  const viewersCount = useQuery({
    queryKey: ["story-viewers-count", story?.id],
    enabled: !!story && isOwn,
    queryFn: async () => {
      const { count } = await supabase
        .from("story_views")
        .select("user_id", { count: "exact", head: true })
        .eq("story_id", story!.id);
      return count ?? 0;
    },
  });

  const viewers = useQuery({
    queryKey: ["story-viewers", story?.id],
    enabled: viewersOpen && !!story && isOwn,
    queryFn: async () => {
      const { data: views } = await supabase
        .from("story_views")
        .select("user_id,created_at")
        .eq("story_id", story!.id)
        .order("created_at", { ascending: false });
      const ids = [...new Set((views ?? []).map((v) => v.user_id))];
      if (!ids.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids);
      return (views ?? []).map((v) => ({
        ...v,
        username: people?.find((p) => p.id === v.user_id)?.username ?? "player",
        avatar_url: people?.find((p) => p.id === v.user_id)?.avatar_url ?? null,
      }));
    },
  });

  async function react(reaction: string) {
    if (!user || !story || isOwn) return;
    await supabase.from("story_reactions").upsert({ story_id: story.id, user_id: user.id, reaction });
    toast.success(reaction);
  }

  async function sendReply() {
    if (!user || !story || !replyText.trim()) return;
    try {
      const { data: conversationId, error } = await supabase.rpc("start_direct_message", {
        _target: story.user_id,
      });
      if (error) throw error;
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        kind: "text",
        content: replyText.trim(),
        story_id: story.id,
      });
      setReplyText("");
      toast.success(t("storyReplySent"));
    } catch {
      toast.error(t("errorGeneric"));
    }
  }

  async function deleteStory() {
    if (!story || !confirm(t("storyDeleteConfirm"))) return;
    await supabase.from("stories").delete().eq("id", story.id);
    setMenuOpen(false);
    onChanged();
    next();
  }

  function onPointerDown(clientX: number, clientY: number) {
    startPos.current = { x: clientX, y: clientY };
    holdTimer.current = window.setTimeout(() => setPaused(true), 220);
  }

  function onPointerUp(clientX: number, clientY: number) {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    const wasPaused = paused;
    setPaused(false);
    if (!startPos.current) return;
    const dx = clientX - startPos.current.x;
    const dy = clientY - startPos.current.y;
    startPos.current = null;
    if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) {
      close();
      return;
    }
    if (Math.abs(dx) > 60) {
      if (dx < 0) goToStory(groupIndex + 1, 0);
      else goToStory(groupIndex - 1, 0);
      return;
    }
    if (wasPaused) return; // was a hold, not a tap
    if (clientX < window.innerWidth * 0.35) prev();
    else next();
  }

  const overlays = useMemo(() => story?.metadata?.overlays ?? [], [story]);

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-[95] overflow-hidden overscroll-contain bg-black">
      <div className="relative mx-auto h-full w-full max-w-md">
        <div
          className="absolute inset-0"
          onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
          onMouseUp={(e) => onPointerUp(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t0 = e.touches[0];
            if (t0) onPointerDown(t0.clientX, t0.clientY);
          }}
          onTouchEnd={(e) => {
            const t0 = e.changedTouches[0];
            if (t0) onPointerUp(t0.clientX, t0.clientY);
          }}
        >
          {url ? (
            story.media_type === "video" ? (
              <video
                ref={videoRef}
                src={url}
                autoPlay
                muted={muted}
                playsInline
                className="h-full w-full object-contain"
                onEnded={next}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress(v.currentTime / v.duration);
                }}
              />
            ) : (
              <img src={url} alt="" className="h-full w-full object-contain" />
            )
          ) : null}

          {soundUrl ? (
            <audio ref={soundRef} src={soundUrl} loop muted={muted} />
          ) : null}

          {overlays.map((o) => (
            <div
              key={o.id}
              style={{
                left: `${o.x}%`,
                top: `${o.y}%`,
                color: o.color ?? "#fff",
                transform: `translate(-50%, -50%) scale(${o.scale ?? 1}) rotate(${o.rotation ?? 0}deg)`,
              }}
              className={cn(
                "pointer-events-none absolute",
                o.type === "text"
                  ? cn(
                      "rounded-xl bg-black/40 px-3 py-1.5 text-lg font-bold",
                      OVERLAY_FONT_CLASS[o.font ?? "sans"],
                    )
                  : "text-4xl",
              )}
            >
              {o.content}
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1 p-2">
          {group.stories.map((s, i) => (
            <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full bg-white transition-[width]"
                style={{
                  width: i < storyIndex ? "100%" : i === storyIndex ? `${progress * 100}%` : "0%",
                }}
              />
            </span>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-4 flex items-center gap-2.5 px-3 pt-3 text-white">
          <StoredImage
            path={group.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full"
            fallback={group.username[0]?.toUpperCase() ?? "?"}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">@{group.username}</p>
            <p className="text-[11px] text-white/70">{formatRelativeTime(story.created_at, t)}</p>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            {story.media_type === "video" || soundUrl ? (
              <button
                onClick={() => setMuted((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/40"
                aria-label={muted ? t("unmute") : t("mute")}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            ) : null}
            {isOwn ? (
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/40"
                aria-label="..."
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            ) : null}
            <button
              onClick={close}
              className="grid h-8 w-8 place-items-center rounded-full bg-black/40"
              aria-label={t("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="absolute right-3 top-16 z-10 w-52 rounded-2xl bg-neutral-900 p-1.5 text-sm text-white shadow-xl">
            <button
              onClick={() => {
                setMenuOpen(false);
                setViewersOpen(true);
              }}
              className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/10"
            >
              {t("storyViewViewers")}
            </button>
            <button
              onClick={() => void deleteStory()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-destructive hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" /> {t("delete")}
            </button>
          </div>
        ) : null}

        {isOwn ? (
          <button
            onClick={() => setViewersOpen(true)}
            className="absolute bottom-24 left-4 flex items-center gap-1.5 text-xs font-bold text-white/80"
          >
            👁 {t("storyViewersCount", { count: viewersCount.data ?? 0 })}
          </button>
        ) : null}

        {!isOwn ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendReply()}
              placeholder={t("storyReplyPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-sm text-white outline-none placeholder:text-white/60"
            />
            {QUICK_REACTIONS.map((r) => (
              <button
                key={r}
                onClick={() => void react(r)}
                className="shrink-0 text-2xl transition active:scale-125"
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => void sendReply()}
              disabled={!replyText.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label={t("send")}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {viewersOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
          onClick={() => setViewersOpen(false)}
        >
          <div
            className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <b>{t("storyViewViewers")}</b>
              <button onClick={() => setViewersOpen(false)} aria-label={t("cancel")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {(viewers.data ?? []).map((v) => (
                <button
                  key={v.user_id}
                  onClick={() => {
                    setViewersOpen(false);
                    close();
                    void navigate({ to: "/users/$id", params: { id: v.username || v.user_id } });
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-2"
                >
                  <StoredImage
                    path={v.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full"
                    fallback={v.username[0]?.toUpperCase() ?? "?"}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">@{v.username}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleTimeString(lang, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))}
              {!viewers.data?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("storyNoViewersYet")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
