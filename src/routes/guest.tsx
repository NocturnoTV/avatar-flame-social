import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Heart, MessageCircle, Settings, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState, type Ref } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type MuxPlayerElement from "@mux/mux-player";
import { LogoWordmark } from "@/components/Logo";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { Button, Select } from "@/components/ui-kit";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import { useTheme, type ThemeName } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/guest")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guest preview - BloxSpark" },
      {
        name: "description",
        content: "Watch the BloxSpark video feed as a guest - no account needed to browse.",
      },
      { property: "og:title", content: "Guest preview - BloxSpark" },
      { property: "og:description", content: "Watch the BloxSpark video feed as a guest." },
      { property: "og:url", content: "https://bloxspark.app/guest" },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/guest" }],
  }),
  component: GuestPage,
});

const VIDEO_GATE_THRESHOLD = 10;

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}

type GuestVideo = {
  id: string;
  user_id: string;
  storage_path: string | null;
  mux_playback_id: string | null;
  mux_status: string | null;
  caption: string | null;
  likes_count: number;
  comments_count: number;
  username: string | null;
  avatar_url: string | null;
};

function GuestPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gate, setGate] = useState<"limit" | "locked" | null>(null);
  const seenCount = useRef(0);
  const gateShown = useRef(false);

  useEffect(() => {
    window.localStorage.setItem("bloxspark-guest", "true");
    setLang((window.localStorage.getItem("bloxspark-lang") as LangCode) ?? "en");
    setTheme("dark");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session) navigate({ to: "/home", replace: true });
  }, [session, navigate]);

  const videos = useQuery({
    queryKey: ["guest-videos"],
    queryFn: async (): Promise<GuestVideo[]> => {
      const { data: rows, error } = await supabase
        .from("videos")
        .select("id,user_id,storage_path,mux_playback_id,mux_status,caption,likes_count,comments_count")
        .eq("visibility", "public")
        .order("views_count", { ascending: false })
        .limit(30);
      if (error) throw error;
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({
        ...r,
        username: byId.get(r.user_id)?.username ?? null,
        avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
      }));
    },
    retry: false,
  });

  function onVideoSeen() {
    seenCount.current += 1;
    if (seenCount.current >= VIDEO_GATE_THRESHOLD && !gateShown.current) {
      gateShown.current = true;
      setGate("limit");
    }
  }

  const feed = videos.data ?? [];

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <LogoWordmark className="h-9" />
          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            {t("guestBadge")}
          </span>
        </div>
      </header>

      <main className="h-full snap-y snap-mandatory overflow-y-auto pt-16 pb-20">
        {videos.isLoading ? (
          <div className="grid h-[calc(100dvh-9rem)] place-items-center text-muted-foreground">
            {t("loading")}
          </div>
        ) : feed.length === 0 ? (
          <div className="grid h-[calc(100dvh-9rem)] place-items-center px-8 text-center text-muted-foreground">
            {t("noVideos")}
          </div>
        ) : (
          feed.map((video) => (
            <GuestVideoCard key={video.id} video={video} onSeen={onVideoSeen} onLockedAction={() => setGate("locked")} />
          ))
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-3">
          <button className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-primary">
            <Compass className="h-5 w-5" /> {t("discover")}
          </button>
          <button
            onClick={() => setGate("locked")}
            className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"
          >
            <MessageCircle className="h-5 w-5" /> {t("messages")}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"
          >
            <Settings className="h-5 w-5" /> {t("settings")}
          </button>
        </div>
      </nav>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <button
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setSettingsOpen(false)}
          />
          <section className="relative w-full rounded-t-[2rem] border border-border bg-card p-6 sm:max-w-sm sm:rounded-[2rem]">
            <button
              className="absolute right-5 top-5"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold">{t("guestSettings")}</h2>
            <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("language")}
            </label>
            <Select
              className="mt-2"
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.flag} {language.label}
                </option>
              ))}
            </Select>
            <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("theme")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["dark", "light"] as ThemeName[]).map((value) => (
                <Button
                  key={value}
                  variant={theme === value ? "primary" : "outline"}
                  onClick={() => setTheme(value)}
                >
                  {t(value)}
                </Button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {gate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-md">
          <section className="w-full max-w-sm rounded-[2rem] border border-primary/30 bg-card p-7 text-center shadow-2xl shadow-primary/20">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <UserPlus className="h-7 w-7" />
            </span>
            <h2 className="mt-5 text-2xl font-extrabold">{t("guestGateTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {gate === "locked" ? t("guestActionLocked") : t("guestGateBody")}
            </p>
            <Link to="/auth" search={{ mode: "signup" }} className="mt-6 block">
              <Button className="w-full" size="lg">
                {t("createAccount")}
              </Button>
            </Link>
            <button
              className="mt-4 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setGate(null)}
            >
              {t("continueBrowsing")}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function GuestVideoCard({
  video,
  onSeen,
  onLockedAction,
}: {
  video: GuestVideo;
  onSeen: () => void;
  onLockedAction: () => void;
}) {
  const isMuxReady = video.mux_status === "ready" && !!video.mux_playback_id;
  const url = useSignedUrl(isMuxReady ? null : video.storage_path);
  const ref = useRef<HTMLVideoElement | MuxPlayerElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = (entries[0]?.intersectionRatio ?? 0) > 0.6;
        const videoEl = ref.current;
        if (!videoEl) return;
        if (visible) {
          void videoEl.play().catch(() => undefined);
          if (!seen.current) {
            seen.current = true;
            onSeen();
          }
        } else {
          videoEl.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const muxPosterUrl = isMuxReady
    ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg?width=720`
    : null;

  return (
    <div
      ref={containerRef}
      className="flex min-h-[calc(100dvh-9rem)] snap-start items-center justify-center bg-black px-0 py-0"
    >
      <div className="relative aspect-[9/16] h-full max-h-full w-full max-w-full overflow-hidden bg-black sm:max-w-md sm:rounded-2xl">
        {isMuxReady ? (
          <MuxPlayer
            ref={ref as Ref<MuxPlayerElement>}
            playbackId={video.mux_playback_id!}
            streamType="on-demand"
            {...(muxPosterUrl ? { poster: muxPosterUrl } : {})}
            loop
            muted
            playsInline
            nohotkeys
            metadata={{ video_id: video.id }}
            className="h-full w-full object-cover"
          />
        ) : url ? (
          <video
            ref={ref as Ref<HTMLVideoElement>}
            src={url}
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/50">…</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 pb-6 pr-20">
          <p className="text-[15px] font-extrabold text-white drop-shadow">
            @{video.username ?? "player"}
          </p>
          {video.caption ? (
            <p className="mt-1 line-clamp-3 text-sm text-white/95 drop-shadow">{video.caption}</p>
          ) : null}
        </div>
        <div className="absolute bottom-20 right-2.5 z-20 flex flex-col items-center gap-3.5">
          <StoredImage
            path={video.avatar_url}
            alt=""
            className="h-10 w-10 rounded-full border-2 border-white object-cover"
            fallback="🎮"
          />
          <button
            onClick={onLockedAction}
            aria-label="Like"
            className="flex flex-col items-center gap-0.5 text-white active:scale-90"
          >
            <Heart className="h-[26px] w-[26px] drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]" />
            <span className="text-[11px] font-bold drop-shadow">{formatCount(video.likes_count)}</span>
          </button>
          <button
            onClick={onLockedAction}
            aria-label="Comment"
            className="flex flex-col items-center gap-0.5 text-white active:scale-90"
          >
            <MessageCircle className="h-[26px] w-[26px] drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]" />
            <span className="text-[11px] font-bold drop-shadow">{formatCount(video.comments_count)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
