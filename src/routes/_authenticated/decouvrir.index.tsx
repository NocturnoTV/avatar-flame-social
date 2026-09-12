import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BarChart3,
  Bookmark,
  Heart,
  MessageCircle,
  Music2,
  Play,
  Plus,
  Repeat2,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSignedUrl, StoredImage } from "@/components/Media";
import { Button } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/decouvrir/")({
  head: () => ({
    meta: [
      { title: "Découvrir — Bloxspark" },
      {
        name: "description",
        content: "Le feed vidéo des joueurs Roblox : likes, favoris, abonnements et republications.",
      },
      { property: "og:title", content: "Découvrir — Bloxspark" },
      { property: "og:description", content: "Des vidéos Roblox en boucle, façon feed vertical." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

type VideoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  sound_name: string | null;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  reposts_count: number;
  shares_count: number;
  views_count: number;
};

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}

function DiscoverPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [muted, setMuted] = useState(true);
  const [comments, setComments] = useState<VideoRow | null>(null);

  const following = useQuery({
    queryKey: ["following", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id");
      return (data ?? []).map((r) => r.following_id);
    },
  });

  const feed = useQuery({
    queryKey: ["feed", tab, following.data?.join(",")],
    enabled: !!user && following.isFetched,
    queryFn: async () => {
      let q = supabase
        .from("videos")
        .select(
          "id,user_id,storage_path,thumbnail_path,caption,sound_name,likes_count,comments_count,favorites_count,reposts_count,shares_count,views_count",
        )
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(30);
      if (tab === "following") {
        const ids = following.data ?? [];
        if (ids.length === 0) return { videos: [] as VideoRow[], profiles: {}, photos: {} };
        q = q.in("user_id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      const videos = (data ?? []) as VideoRow[];
      const ids = [...new Set(videos.map((v) => v.user_id))];
      const profiles: Record<string, { username: string | null }> = {};
      const photos: Record<string, string> = {};
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id,username").in("id", ids);
        for (const row of p ?? []) profiles[row.id] = { username: row.username };
        const { data: ph } = await supabase
          .from("profile_photos")
          .select("user_id,url,position")
          .in("user_id", ids)
          .order("position");
        for (const row of ph ?? []) if (!photos[row.user_id]) photos[row.user_id] = row.url;
      }
      return { videos, profiles, photos };
    },
  });

  const videos = feed.data?.videos ?? [];

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] w-full overflow-hidden bg-black lg:h-dvh">
      {/* top bar — style TikTok : onglets centrés, actions à droite */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-3 pb-8 pt-3">
        <div className="pointer-events-auto flex w-20 items-center gap-1">
          <button
            onClick={() => setMuted((m) => !m)}
            className="grid h-9 w-9 place-items-center rounded-full text-white/90 transition active:scale-90"
            aria-label={muted ? "Activer le son" : "Couper le son"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-5">
          {(
            [
              ["following", "Suivis"],
              ["foryou", "Pour toi"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "relative pb-1.5 text-[15px] transition",
                tab === value ? "font-extrabold text-white" : "font-semibold text-white/60",
              )}
            >
              {label}
              <span
                className={cn(
                  "absolute inset-x-0 -bottom-0.5 mx-auto h-[3px] rounded-full bg-white transition-all duration-300",
                  tab === value ? "w-7 opacity-100" : "w-0 opacity-0",
                )}
              />
            </button>
          ))}
        </div>

        <div className="pointer-events-auto flex w-20 items-center justify-end gap-1">
          <Link
            to="/decouvrir/studio"
            className="grid h-9 w-9 place-items-center rounded-full text-white/90 transition active:scale-90"
            aria-label="Studio créateur"
          >
            <BarChart3 className="h-5 w-5" />
          </Link>
          <Link
            to="/decouvrir/studio"
            className="grid h-9 w-9 place-items-center rounded-full text-white/90 transition active:scale-90"
            aria-label="Publier une vidéo"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>
      </div>

      {feed.isLoading ? (
        <div className="grid h-full place-items-center text-white/60">Chargement…</div>
      ) : videos.length === 0 ? (
        <div className="grid h-full place-items-center px-8 text-center">
          <div className="space-y-4">
            <Play className="mx-auto h-12 w-12 text-white/40" />
            <p className="text-white/70">
              {tab === "following"
                ? "Aucune vidéo de tes abonnements pour l'instant."
                : "Aucune vidéo pour le moment. Sois le premier à publier !"}
            </p>
            <Link to="/decouvrir/studio">
              <Button>Publier une vidéo</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
          {videos.map((video) => (
            <VideoSlide
              key={video.id}
              video={video}
              muted={muted}
              username={feed.data?.profiles[video.user_id]?.username ?? "joueur"}
              avatar={feed.data?.photos[video.user_id] ?? null}
              onComments={() => setComments(video)}
            />
          ))}
        </div>
      )}

      {comments ? <CommentsSheet video={comments} onClose={() => setComments(null)} /> : null}
    </div>
  );
}

function VideoSlide({
  video,
  muted,
  username,
  avatar,
  onComments,
}: {
  video: VideoRow;
  muted: boolean;
  username: string;
  avatar: string | null;
  onComments: () => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const url = useSignedUrl(video.storage_path);
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const viewed = useRef(false);
  const isMine = user?.id === video.user_id;

  const state = useQuery({
    queryKey: ["video-state", video.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [liked, faved, reposted, follow] = await Promise.all([
        supabase.from("video_likes").select("video_id").eq("video_id", video.id).eq("user_id", user!.id).maybeSingle(),
        supabase
          .from("video_favorites")
          .select("video_id")
          .eq("video_id", video.id)
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("video_reposts")
          .select("video_id")
          .eq("video_id", video.id)
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user!.id)
          .eq("following_id", video.user_id)
          .maybeSingle(),
      ]);
      return {
        liked: !!liked.data,
        faved: !!faved.data,
        reposted: !!reposted.data,
        following: !!follow.data,
      };
    },
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => setVisible((entries[0]?.intersectionRatio ?? 0) > 0.6), {
      threshold: [0, 0.6, 1],
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible) {
      void el.play().catch(() => undefined);
      if (!viewed.current && user) {
        viewed.current = true;
        void supabase.from("video_views").insert({ video_id: video.id, viewer_id: user.id });
      }
    } else {
      el.pause();
    }
  }, [visible, user, video.id]);

  async function toggle(table: "video_likes" | "video_favorites" | "video_reposts", on: boolean) {
    if (!user) return;
    if (on) {
      await supabase.from(table).delete().eq("video_id", video.id).eq("user_id", user.id);
    } else {
      await supabase.from(table).insert({ video_id: video.id, user_id: user.id });
    }
    await qc.invalidateQueries({ queryKey: ["video-state", video.id] });
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }

  async function toggleFollow() {
    if (!user || isMine) return;
    if (state.data?.following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", video.user_id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: video.user_id });
    }
    await qc.invalidateQueries({ queryKey: ["video-state"] });
    await qc.invalidateQueries({ queryKey: ["following"] });
  }

  async function share() {
    const link = `${window.location.origin}/decouvrir`;
    try {
      if (navigator.share) await navigator.share({ title: `Vidéo de @${username}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast.success("Lien copié");
      }
      await supabase
        .from("videos")
        .update({ shares_count: video.shares_count + 1 })
        .eq("id", video.id);
    } catch {
      /* annulé */
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full snap-start snap-always items-center justify-center bg-black"
    >
      <div className="relative aspect-[9/16] h-full max-h-full w-full max-w-full overflow-hidden bg-black lg:w-auto lg:rounded-2xl lg:shadow-2xl lg:shadow-black/60 lg:ring-1 lg:ring-white/10">
      {url ? (
        <video
          ref={ref}
          src={url}
          loop
          playsInline
          muted={muted}
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            if (el.paused) void el.play();
            else el.pause();
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-white/50">Chargement de la vidéo…</div>
      )}

      {/* bottom info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 pb-6 pr-24">
        <p className="text-[15px] font-extrabold text-white drop-shadow">@{username}</p>
        {video.caption ? (
          <p className="mt-1 line-clamp-3 text-sm text-white/95 drop-shadow">{video.caption}</p>
        ) : null}
        <p className="mt-2 flex items-center gap-2 overflow-hidden text-xs font-medium text-white/90">
          <Music2 className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span className="truncate">{video.sound_name || `Son original — @${username}`}</span>
        </p>
      </div>

      {/* disque vinyle du son */}
      <div className="pointer-events-none absolute bottom-6 right-3 z-20 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-neutral-700 to-black bx-spin">
        <div className="h-7 w-7 overflow-hidden rounded-full border border-white/30">
          <StoredImage path={avatar} alt="" className="h-full w-full" fallback="🎵" />
        </div>
      </div>

      {/* action rail */}
      <div className="absolute bottom-24 right-2 z-20 flex flex-col items-center gap-5">
        <div className="relative">
          <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white">
            <StoredImage path={avatar} alt={username} className="h-full w-full" fallback="🎮" />
          </div>
          {!isMine ? (
            <button
              onClick={toggleFollow}
              aria-label="S'abonner"
              className={cn(
                "absolute -bottom-2 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full text-white transition",
                state.data?.following ? "bg-surface-2 text-foreground" : "spark-gradient",
              )}
            >
              {state.data?.following ? "✓" : <Plus className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        <RailButton
          icon={Heart}
          active={state.data?.liked}
          activeClass="fill-primary text-primary"
          count={video.likes_count}
          onClick={() => toggle("video_likes", !!state.data?.liked)}
          label="J'aime"
        />
        <RailButton icon={MessageCircle} count={video.comments_count} onClick={onComments} label="Commentaires" />
        <RailButton
          icon={Bookmark}
          active={state.data?.faved}
          activeClass="fill-yellow-400 text-yellow-400"
          count={video.favorites_count}
          onClick={() => toggle("video_favorites", !!state.data?.faved)}
          label="Favoris"
        />
        <RailButton
          icon={Repeat2}
          active={state.data?.reposted}
          activeClass="text-emerald-400"
          count={video.reposts_count}
          onClick={() => toggle("video_reposts", !!state.data?.reposted)}
          label="Republier"
        />
        <RailButton icon={Send} count={video.shares_count} onClick={share} label="Partager" />
      </div>
    </div>
  );
}

function RailButton({
  icon: Icon,
  count,
  onClick,
  active,
  activeClass,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  count: number;
  onClick: () => void;
  active?: boolean | undefined;
  activeClass?: string | undefined;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center gap-1 transition active:scale-90"
    >
      <Icon
        className={cn(
          "h-8 w-8 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.5)] transition-transform duration-200",
          active && activeClass,
          active && "scale-110",
        )}
      />
      <span className="text-xs font-bold text-white drop-shadow">{formatCount(count)}</span>
    </button>
  );
}

function CommentsSheet({ video, onClose }: { video: VideoRow; onClose: () => void }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const comments = useQuery({
    queryKey: ["video-comments", video.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_comments")
        .select("id,user_id,content,created_at")
        .eq("video_id", video.id)
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id,username").in("id", ids);
        for (const row of p ?? []) names[row.id] = row.username ?? "joueur";
      }
      return rows.map((r) => ({ ...r, username: names[r.user_id] ?? "joueur" }));
    },
  });

  async function send() {
    const content = text.trim();
    if (!content || !user) return;
    setText("");
    const { error } = await supabase.from("video_comments").insert({
      video_id: video.id,
      user_id: user.id,
      content,
    });
    if (error) toast.error(error.message);
    await comments.refetch();
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }

  const total = comments.data?.length ?? 0;

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-[70%] w-full flex-col rounded-t-3xl bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-bold">{total} commentaire{total > 1 ? "s" : ""}</span>
          <button onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {comments.data?.length ? (
            comments.data.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm">🎮</div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-muted-foreground">@{c.username}</p>
                  <p className="text-sm text-foreground">{c.content}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Sois le premier à commenter ✨</p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ajoute un commentaire…"
            className="h-11 flex-1 rounded-full border border-input bg-surface px-4 text-sm outline-none focus:border-primary"
          />
          <Button size="icon" onClick={send} aria-label="Envoyer">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
