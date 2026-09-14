import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Bookmark,
  AtSign,
  Check,
  EyeOff,
  Eye,
  Gift,
  Heart,
  ImagePlus,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  Reply,
  Repeat2,
  Search,
  Send,
  SlidersHorizontal,
  Smile,
  Sparkles,
  ThumbsDown,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSignedUrl, StoredImage } from "@/components/Media";
import { GiftSheet } from "@/components/GiftSheet";
import { Button } from "@/components/ui-kit";
import { cn, errorMessage } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  getPersonalizedFeed,
  logPositiveAction,
  logVideoWatch,
  markNotInterested,
} from "@/lib/recommendation.functions";

export const Route = createFileRoute("/_authenticated/discover/")({
  validateSearch: (search: Record<string, unknown>): { v?: string } =>
    typeof search["v"] === "string" ? { v: search["v"] } : {},
  head: () => ({
    meta: [
      { title: "Découvrir - Bloxspark" },
      {
        name: "description",
        content:
          "Le feed vidéo des joueurs Roblox : likes, favoris, abonnements et republications.",
      },
      { property: "og:title", content: "Découvrir - Bloxspark" },
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
  boosted_until?: string | null;
  reason?: string;
};

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}

function DiscoverPage() {
  const { user } = useSession();
  const { t } = useI18n();
  const { v: pinnedVideoId } = Route.useSearch();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [muted, setMuted] = useState(
    () => window.localStorage.getItem("bloxspark-discover-muted") === "true",
  );
  const [comments, setComments] = useState<VideoRow | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [spotlight, setSpotlight] = useState<{
    video: VideoRow;
    username: string;
    avatar: string | null;
  } | null>(null);

  const following = useQuery({
    queryKey: ["following", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      return (data ?? []).map((r) => r.following_id);
    },
  });

  const feed = useQuery({
    queryKey: ["feed", tab, following.data?.join(","), pinnedVideoId],
    enabled: !!user && following.isFetched,
    queryFn: async () => {
      let videos: VideoRow[];
      if (tab === "foryou") {
        // Personalized ranking - see src/lib/recommendation-engine.server.ts
        const rows = await getPersonalizedFeed({ data: { limit: 30 } });
        videos = rows.map((v) => ({ ...v, thumbnail_path: null }));
      } else {
        const ids = following.data ?? [];
        if (ids.length === 0) return { videos: [] as VideoRow[], profiles: {} };
        const { data, error } = await supabase
          .from("videos")
          .select(
            "id,user_id,storage_path,thumbnail_path,caption,sound_name,likes_count,comments_count,favorites_count,reposts_count,shares_count,views_count,boosted_until",
          )
          .eq("visibility", "public")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
          .limit(30);
        if (error) throw error;
        videos = (data ?? []) as VideoRow[];
      }

      // Deep-linked from a video thumbnail elsewhere (e.g. Home's Discover
      // preview) - pin it as the first slide of the scroll feed.
      if (pinnedVideoId && !videos.some((v) => v.id === pinnedVideoId)) {
        const { data: pinned } = await supabase
          .from("videos")
          .select(
            "id,user_id,storage_path,thumbnail_path,caption,sound_name,likes_count,comments_count,favorites_count,reposts_count,shares_count,views_count,boosted_until",
          )
          .eq("id", pinnedVideoId)
          .maybeSingle();
        if (pinned) videos = [pinned as VideoRow, ...videos];
      } else if (pinnedVideoId) {
        videos = [
          videos.find((v) => v.id === pinnedVideoId)!,
          ...videos.filter((v) => v.id !== pinnedVideoId),
        ];
      }

      const ids = [...new Set(videos.map((v) => v.user_id))];
      const profiles: Record<string, { username: string | null; avatar_url: string | null }> = {};
      if (ids.length) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id,username,avatar_url")
          .in("id", ids);
        for (const row of p ?? [])
          profiles[row.id] = { username: row.username, avatar_url: row.avatar_url };
        const { data: plusProfiles } = await supabase
          .from("profiles")
          .select("id,spark_plus_active,spark_plus_expires_at")
          .in("id", ids);
        const boosted = new Set(
          (plusProfiles ?? [])
            .filter(
              (profile) =>
                profile.spark_plus_active &&
                (!profile.spark_plus_expires_at ||
                  new Date(profile.spark_plus_expires_at).getTime() > Date.now()),
            )
            .map((profile) => profile.id),
        );
        videos = videos
          .map((video, index) => ({ video, index }))
          .sort((a, b) => {
            const boostDifference =
              Number(boosted.has(b.video.user_id)) - Number(boosted.has(a.video.user_id));
            return boostDifference || a.index - b.index;
          })
          .map(({ video }) => video);
      }
      return { videos, profiles };
    },
  });

  const searchResults = useQuery({
    queryKey: ["discover-search", searchQuery.trim().toLowerCase()],
    enabled: searchOpen && searchQuery.trim().length >= 2,
    queryFn: async () => {
      const query = searchQuery.trim();
      const [{ data: creators }, { data: foundVideos }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,username,avatar_url,verified")
          .ilike("username", `%${query}%`)
          .limit(12),
        supabase
          .from("videos")
          .select(
            "id,user_id,storage_path,thumbnail_path,caption,sound_name,likes_count,comments_count,favorites_count,reposts_count,shares_count,views_count,boosted_until",
          )
          .eq("visibility", "public")
          .ilike("caption", `%${query}%`)
          .order("views_count", { ascending: false })
          .limit(12),
      ]);
      const creatorIds = [...new Set((foundVideos ?? []).map((video) => video.user_id))];
      const { data: videoCreators } = creatorIds.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", creatorIds)
        : { data: [] as { id: string; username: string | null; avatar_url: string | null }[] };
      const creatorById = new Map((videoCreators ?? []).map((creator) => [creator.id, creator]));
      return {
        creators: creators ?? [],
        videos: ((foundVideos ?? []) as VideoRow[]).map((video) => ({
          video,
          username: creatorById.get(video.user_id)?.username ?? t("someone"),
          avatar: creatorById.get(video.user_id)?.avatar_url ?? null,
        })),
      };
    },
  });

  const videos = feed.data?.videos ?? [];
  const displayedVideos = spotlight
    ? [spotlight.video, ...videos.filter((video) => video.id !== spotlight.video.id)]
    : videos;

  return (
    <div className="relative h-[calc(100dvh-5.75rem)] w-full overflow-hidden bg-background lg:h-dvh">
      {/* top bar - style TikTok : onglets centrés, actions à droite */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-3 pb-8 pt-3">
        <div className="pointer-events-auto flex w-20 items-center gap-1">
          <button
            onClick={() =>
              setMuted((current) => {
                const next = !current;
                window.localStorage.setItem("bloxspark-discover-muted", String(next));
                return next;
              })
            }
            className="grid h-9 w-9 place-items-center rounded-full text-white/90 transition active:scale-90"
            aria-label={muted ? "Activer le son" : "Couper le son"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-5">
          {(
            [
              ["following", t("following")],
              ["foryou", t("forYou")],
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

        <div className="pointer-events-auto flex w-20 items-center justify-end">
          <button
            onClick={() => setSearchOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white transition active:scale-90"
            aria-label={t("searchCreatorsAndVideos")}
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>

      {feed.isLoading ? (
        <div className="grid h-full place-items-center text-white/60">Chargement…</div>
      ) : displayedVideos.length === 0 ? (
        <div className="grid h-full place-items-center px-8 text-center">
          <div className="space-y-4">
            <Play className="mx-auto h-12 w-12 text-white/40" />
            <p className="text-white/70">
              {tab === "following" ? t("noFollowingVideos") : t("noFeedVideos")}
            </p>
            <Link to="/discover/studio">
              <Button>{t("publishVideo")}</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
          {displayedVideos.map((video) => {
            const highlighted = spotlight?.video.id === video.id ? spotlight : null;
            return (
              <VideoSlide
                key={video.id}
                video={video}
                muted={muted}
                username={
                  highlighted?.username ??
                  feed.data?.profiles[video.user_id]?.username ??
                  t("someone")
                }
                avatar={
                  highlighted?.avatar ?? feed.data?.profiles[video.user_id]?.avatar_url ?? null
                }
                onComments={() => setComments(video)}
                onNotInterested={() => {
                  void markNotInterested({ data: { videoId: video.id } });
                  queryClient.setQueryData<typeof feed.data>(
                    ["feed", tab, following.data?.join(",")],
                    (current) =>
                      current
                        ? { ...current, videos: current.videos.filter((v) => v.id !== video.id) }
                        : current,
                  );
                  toast.success(t("notInterestedDone"));
                }}
              />
            );
          })}
          <div className="flex h-full w-full snap-start snap-always items-center justify-center bg-background px-8 text-center">
            <div className="space-y-4">
              <Sparkles className="mx-auto h-12 w-12 text-primary" />
              <div>
                <p className="text-lg font-black text-foreground">{t("feedEndTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("feedEndSubtitle")}</p>
              </div>
              <Link to="/discover/studio">
                <Button>{t("publishVideo")}</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {comments ? <CommentsSheet video={comments} onClose={() => setComments(null)} /> : null}
      {searchOpen ? (
        <DiscoverSearch
          query={searchQuery}
          onQuery={setSearchQuery}
          results={searchResults.data}
          loading={searchResults.isFetching}
          onClose={() => setSearchOpen(false)}
          onVideo={(result) => {
            setSpotlight(result);
            setSearchOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

type DiscoverSearchResults = {
  creators: Array<{
    id: string;
    username: string | null;
    avatar_url: string | null;
    verified: boolean | null;
  }>;
  videos: Array<{ video: VideoRow; username: string; avatar: string | null }>;
};

function DiscoverSearch({
  query,
  onQuery,
  results,
  loading,
  onClose,
  onVideo,
}: {
  query: string;
  onQuery: (value: string) => void;
  results: DiscoverSearchResults | undefined;
  loading: boolean;
  onClose: () => void;
  onVideo: (result: DiscoverSearchResults["videos"][number]) => void;
}) {
  const { t } = useI18n();
  const hasQuery = query.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-[80] bg-background/95 text-foreground backdrop-blur-xl">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pb-8 pt-4">
        <div className="flex items-center gap-2">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 focus-within:border-primary">
            <Search className="h-5 w-5 shrink-0 text-primary" />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={t("searchCreatorsAndVideos")}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
            {query ? (
              <button onClick={() => onQuery("")} aria-label={t("cancel")}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : null}
          </label>
          <button
            onClick={onClose}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full hover:bg-surface-2"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex-1 overflow-y-auto">
          {!hasQuery ? (
            <div className="grid h-2/3 place-items-center text-center text-muted-foreground">
              <div>
                <Search className="mx-auto h-12 w-12 text-primary/45" />
                <p className="mt-3 text-sm">{t("discoverSearchHint")}</p>
              </div>
            </div>
          ) : loading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t("loading")}</p>
          ) : (
            <div className="space-y-7">
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-primary">
                  {t("creators")}
                </h2>
                <div className="space-y-2">
                  {(results?.creators ?? []).map((creator) => (
                    <Link
                      key={creator.id}
                      to="/users/$id"
                      params={{ id: creator.username || creator.id }}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/40"
                    >
                      <StoredImage
                        path={creator.avatar_url}
                        alt={creator.username ?? ""}
                        className="h-12 w-12 rounded-full object-cover"
                        fallback={creator.username?.[0]?.toUpperCase() ?? "?"}
                      />
                      <span className="font-bold">@{creator.username ?? t("someone")}</span>
                    </Link>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-primary">
                  {t("videos")}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(results?.videos ?? []).map((result) => (
                    <button
                      key={result.video.id}
                      onClick={() => onVideo(result)}
                      className="overflow-hidden rounded-2xl border border-border bg-card text-left hover:border-primary/40"
                    >
                      <SearchVideoThumb video={result.video} />
                      <span className="block truncate px-3 pt-2 text-xs font-bold">
                        @{result.username}
                      </span>
                      <span className="line-clamp-2 min-h-10 px-3 pb-3 text-xs text-muted-foreground">
                        {result.video.caption || t("videoWithoutCaption")}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              {!results?.creators.length && !results?.videos.length ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {t("noSearchResults")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchVideoThumb({ video }: { video: VideoRow }) {
  const url = useSignedUrl(video.thumbnail_path || video.storage_path);
  return (
    <div className="relative aspect-[9/12] bg-black">
      {url ? (
        video.thumbnail_path ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        )
      ) : null}
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
        <Eye className="h-3 w-3" /> {formatCount(video.views_count)}
      </span>
    </div>
  );
}

function VideoSlide({
  video,
  muted,
  username,
  avatar,
  onComments,
  onNotInterested,
}: {
  video: VideoRow;
  muted: boolean;
  username: string;
  avatar: string | null;
  onComments: () => void;
  onNotInterested: () => void;
}) {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const url = useSignedUrl(video.storage_path);
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [viewCount, setViewCount] = useState(video.views_count);
  const [sharing, setSharing] = useState(false);
  const viewed = useRef(false);
  const isMine = user?.id === video.user_id;

  // --- Watch-time tracking for the recommendation engine (section 2) ---
  const watchStartRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const loopedRef = useRef(false);

  function flushWatch() {
    const el = ref.current;
    const accumulated = accumulatedMsRef.current;
    accumulatedMsRef.current = 0;
    if (!user || accumulated < 150 || !el?.duration) return;
    void logVideoWatch({
      data: {
        videoId: video.id,
        watchMs: accumulated,
        durationSeconds: el.duration,
        replayed: loopedRef.current,
      },
    });
    loopedRef.current = false;
  }

  // Shared across every mounted video item (same key => one request, not
  // one per video) - opt-in "Recents" history, off by default per user.
  const watchHistoryEnabled = useQuery({
    queryKey: ["watch-history-enabled", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("watch_history_enabled")
        .eq("id", user!.id)
        .maybeSingle();
      return !!data?.watch_history_enabled;
    },
  });

  const state = useQuery({
    queryKey: ["video-state", video.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [liked, faved, reposted, follow] = await Promise.all([
        supabase
          .from("video_likes")
          .select("video_id")
          .eq("video_id", video.id)
          .eq("user_id", user!.id)
          .maybeSingle(),
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
    const obs = new IntersectionObserver(
      (entries) => setVisible((entries[0]?.intersectionRatio ?? 0) > 0.6),
      {
        threshold: [0, 0.6, 1],
      },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    if (visible) {
      void el.play().catch(() => undefined);
      watchStartRef.current = performance.now();
      if (!viewed.current && user && user.id !== video.user_id) {
        viewed.current = true;
        // Plain insert, not an upsert - views_count is "how many times this
        // was watched", not "how many distinct people watched it", so a
        // repeat view (in a later session) should add a fresh row.
        void supabase
          .from("video_views")
          .insert({ video_id: video.id, viewer_id: user.id })
          .then(async () => {
            const { data } = await supabase
              .from("videos")
              .select("views_count")
              .eq("id", video.id)
              .maybeSingle();
            if (data) setViewCount(data.views_count);
          });
        if (watchHistoryEnabled.data) {
          void supabase
            .from("watch_history")
            .upsert(
              { user_id: user.id, video_id: video.id, watched_at: new Date().toISOString() },
              { onConflict: "user_id,video_id" },
            );
        }
      }
    } else {
      el.pause();
      if (watchStartRef.current != null) {
        accumulatedMsRef.current += performance.now() - watchStartRef.current;
        watchStartRef.current = null;
      }
      flushWatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, muted, url, user, video.id]);

  // Full loop = a completed watch; keep counting subsequent loops as replays.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onEnded = () => {
      loopedRef.current = true;
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [url]);

  // Flush any in-progress watch session when the slide unmounts entirely.
  useEffect(() => {
    return () => {
      if (watchStartRef.current != null) {
        accumulatedMsRef.current += performance.now() - watchStartRef.current;
        watchStartRef.current = null;
      }
      flushWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(table: "video_likes" | "video_favorites" | "video_reposts", on: boolean) {
    if (!user) return;
    if (on) {
      await supabase.from(table).delete().eq("video_id", video.id).eq("user_id", user.id);
    } else {
      await supabase.from(table).insert({ video_id: video.id, user_id: user.id });
      if (table === "video_likes") {
        void logPositiveAction({ data: { videoId: video.id, action: "like" } });
        void supabase.rpc("bump_quest_progress", {
          _metric_key: "social_spark",
          _entity_id: video.id,
        });
      }
      if (table === "video_favorites") {
        void supabase.rpc("bump_quest_progress", {
          _metric_key: "show_some_love",
          _entity_id: video.id,
        });
      }
      if (table === "video_reposts")
        void logPositiveAction({ data: { videoId: video.id, action: "share" } });
    }
    await qc.invalidateQueries({ queryKey: ["video-state", video.id] });
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }

  async function toggleFollow() {
    if (!user || isMine) return;
    if (state.data?.following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", video.user_id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: video.user_id });
      void logPositiveAction({ data: { videoId: video.id, action: "follow" } });
      void supabase.rpc("bump_quest_progress", {
        _metric_key: "make_a_friend",
        _entity_id: video.user_id,
      });
    }
    await qc.invalidateQueries({ queryKey: ["video-state"] });
    await qc.invalidateQueries({ queryKey: ["following"] });
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full snap-start snap-always items-center justify-center bg-background"
    >
      <div className="relative aspect-[9/16] h-full max-h-full w-full max-w-full overflow-hidden bg-black lg:w-auto lg:rounded-2xl lg:shadow-2xl lg:shadow-black/60 lg:ring-1 lg:ring-white/10">
        {url ? (
          <video
            ref={ref}
            src={url}
            autoPlay
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
          <div className="grid h-full w-full place-items-center text-white/50">
            Chargement de la vidéo…
          </div>
        )}

        {video.boosted_until && new Date(video.boosted_until).getTime() > Date.now() ? (
          <span className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-black text-primary-foreground backdrop-blur">
            🚀 Boostée
          </span>
        ) : null}

        {/* bottom info */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 pb-6 pr-24">
          <Link
            to="/users/$id"
            params={{ id: username || video.user_id }}
            className="pointer-events-auto text-[15px] font-extrabold text-white drop-shadow hover:underline"
          >
            @{username}
          </Link>
          {video.caption ? (
            <p className="mt-1 line-clamp-3 text-sm text-white/95 drop-shadow">
              <MentionText text={video.caption} />
            </p>
          ) : null}
          <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white/90">
            <Eye className="h-3.5 w-3.5" />
            {t("uniqueViews", { count: formatCount(viewCount) })}
          </p>
          <p className="mt-2 flex items-center gap-2 overflow-hidden text-xs font-medium text-white/90">
            <Music2 className="h-3.5 w-3.5 shrink-0 animate-pulse" />
            <span className="truncate">{video.sound_name || `Son original - @${username}`}</span>
          </p>
        </div>

        {/* disque vinyle du son */}
        <div className="pointer-events-none absolute bottom-6 right-3 z-20 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-neutral-700 to-black bx-spin">
          <div className="h-7 w-7 overflow-hidden rounded-full border border-white/30">
            <StoredImage path={avatar} alt="" className="h-full w-full" fallback="🎵" />
          </div>
        </div>

        {/* action rail - compact, TikTok/Instagram-style */}
        <div className="absolute bottom-20 right-2.5 z-20 flex flex-col items-center gap-3.5">
          <div className="relative">
            <Link
              to="/users/$id"
              params={{ id: username || video.user_id }}
              className="block h-10 w-10 overflow-hidden rounded-full border-2 border-white"
              aria-label={`Profil de ${username}`}
            >
              <StoredImage path={avatar} alt={username} className="h-full w-full" fallback="🎮" />
            </Link>
            {!isMine ? (
              <button
                onClick={toggleFollow}
                aria-label="S'abonner"
                className={cn(
                  "absolute -bottom-1.5 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full text-white transition",
                  state.data?.following ? "bg-surface-2 text-foreground" : "spark-gradient",
                )}
              >
                {state.data?.following ? "✓" : <Plus className="h-3 w-3" />}
              </button>
            ) : null}
          </div>

          <RailButton
            icon={Heart}
            active={state.data?.liked}
            activeClass="fill-red-500 text-red-500"
            count={video.likes_count}
            onClick={() => toggle("video_likes", !!state.data?.liked)}
            label="J'aime"
          />
          <RailButton
            icon={MessageCircle}
            count={video.comments_count}
            onClick={onComments}
            label={t("comments")}
          />
          <RailButton
            icon={Bookmark}
            active={state.data?.faved}
            activeClass="fill-yellow-400 text-yellow-400"
            count={video.favorites_count}
            onClick={() => toggle("video_favorites", !!state.data?.faved)}
            label={t("favorites")}
          />
          <RailButton
            icon={Repeat2}
            active={state.data?.reposted}
            activeClass="text-sky-400"
            count={video.reposts_count}
            onClick={() => toggle("video_reposts", !!state.data?.reposted)}
            label={t("repost")}
          />
          <RailButton
            icon={Send}
            count={video.shares_count}
            onClick={() => setSharing(true)}
            label={t("share")}
          />
          {!isMine ? <RailOverflow onNotInterested={onNotInterested} /> : null}
        </div>
      </div>
      {sharing ? (
        <ShareSheet video={video} username={username} onClose={() => setSharing(false)} />
      ) : null}
    </div>
  );
}

function ShareSheet({
  video,
  username,
  onClose,
}: {
  video: VideoRow;
  username: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const link = `${window.location.origin}/discover?v=${video.id}`;

  const matches = useQuery({
    queryKey: ["share-sheet-matches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("matches")
        .select("user_a,user_b")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      const otherIds = (rows ?? []).map((m) => (m.user_a === user!.id ? m.user_b : m.user_a));
      if (!otherIds.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", otherIds);
      return people ?? [];
    },
  });

  async function bumpShares() {
    await supabase
      .from("videos")
      .update({ shares_count: video.shares_count + 1 })
      .eq("id", video.id);
    await qc.invalidateQueries({ queryKey: ["feed"] });
    if (user) {
      void supabase.rpc("bump_quest_progress", { _metric_key: "share_it", _entity_id: video.id });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t("linkCopied"));
      await bumpShares();
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    }
  }

  async function sendTo(friendId: string, friendUsername: string) {
    if (!user || sendingTo) return;
    setSendingTo(friendId);
    try {
      const { data: conversationId, error } = await supabase.rpc("start_direct_message", {
        _target: friendId,
      });
      if (error) throw error;
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversationId as string,
        sender_id: user.id,
        kind: "text",
        content: `🎥 @${username} - ${link}`,
      });
      if (msgError) throw msgError;
      await bumpShares();
      toast.success(t("sentToFriend", { username: friendUsername }));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setSendingTo(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="app-background flex max-h-[75dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-border pb-[env(safe-area-inset-bottom)] shadow-[0_-24px_70px_-30px_rgba(0,0,0,.8)] sm:mb-6 sm:rounded-[2rem] sm:border-b"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-base font-black">{t("share")}</h2>
          <button onClick={onClose} aria-label={t("cancel")} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-5 pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("shareToSparks")}
        </p>
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 py-3">
          {(matches.data ?? []).length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t("noMatchesToShare")}</p>
          ) : (
            (matches.data ?? []).map((m) => (
              <button
                key={m.id}
                onClick={() => void sendTo(m.id, m.username ?? "?")}
                disabled={!!sendingTo}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center disabled:opacity-50"
              >
                <span className="relative">
                  <StoredImage
                    path={m.avatar_url}
                    alt={m.username ?? ""}
                    className="h-14 w-14 rounded-full object-cover ring-1 ring-border"
                    fallback={m.username?.[0]?.toUpperCase() ?? "?"}
                  />
                  {sendingTo === m.id ? (
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate text-[11px] font-semibold">{m.username}</span>
              </button>
            ))
          )}
        </div>

        <div className="mt-1 space-y-1 border-t border-border p-3">
          <button
            onClick={() => void copyLink()}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold hover:bg-surface-2"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
              {copied ? <Check className="h-5 w-5 text-primary" /> : <Link2 className="h-5 w-5" />}
            </span>
            {copied ? t("linkCopied") : t("copyLink")}
          </button>
        </div>
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
      className="flex flex-col items-center gap-0.5 transition active:scale-90"
    >
      <Icon
        className={cn(
          "h-[26px] w-[26px] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.5)] transition-transform duration-200",
          active && activeClass,
          active && "scale-110",
        )}
      />
      <span className="text-[11px] font-bold text-white drop-shadow">{formatCount(count)}</span>
    </button>
  );
}

/** Compact "..." menu - keeps rarer actions (Not interested) off the main rail. */
function RailOverflow({ onNotInterested }: { onNotInterested: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("more")}
        className="flex flex-col items-center gap-0.5 transition active:scale-90"
      >
        <MoreHorizontal className="h-[26px] w-[26px] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-40 mb-2 w-44 overflow-hidden rounded-2xl bg-card text-foreground shadow-xl ring-1 ring-border">
            <button
              onClick={() => {
                onNotInterested();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-semibold hover:bg-surface-2"
            >
              <EyeOff className="h-4 w-4" /> {t("notInterested")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function CommentsSheet({ video, onClose }: { video: VideoRow; onClose: () => void }) {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [media, setMedia] = useState<{ url: string; type: "gif" | "sticker" } | null>(null);
  const [sort, setSort] = useState<"popular" | "recent">("popular");
  const [commentSearch, setCommentSearch] = useState("");

  const myProfile = useQuery({
    queryKey: ["comment-composer-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const comments = useQuery({
    queryKey: ["video-comments", video.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_comments")
        .select("id,user_id,content,created_at,parent_id,media_url,media_type")
        .eq("video_id", video.id)
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const people: Record<string, { username: string; avatar_url: string | null }> = {};
      if (ids.length) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id,username,avatar_url")
          .in("id", ids);
        for (const row of p ?? [])
          people[row.id] = { username: row.username ?? "joueur", avatar_url: row.avatar_url };
      }
      const reactions: Array<{ comment_id: string; user_id: string; reaction: string }> = [];
      if (rows.length) {
        const { data: reactionRows } = await supabase
          .from("video_comment_reactions")
          .select("comment_id,user_id,reaction")
          .in(
            "comment_id",
            rows.map((row) => row.id),
          );
        reactions.push(...(reactionRows ?? []));
      }
      return rows.map((r) => ({
        ...r,
        username: people[r.user_id]?.username ?? "joueur",
        avatar_url: people[r.user_id]?.avatar_url ?? null,
        likes_count: reactions.filter(
          (reaction) => reaction.comment_id === r.id && reaction.reaction === "like",
        ).length,
        dislikes_count: reactions.filter(
          (reaction) => reaction.comment_id === r.id && reaction.reaction === "dislike",
        ).length,
        my_reaction:
          reactions.find(
            (reaction) => reaction.comment_id === r.id && reaction.user_id === user?.id,
          )?.reaction ?? null,
      }));
    },
  });

  async function send() {
    const content = text.trim();
    if ((!content && !media) || !user) return;
    setText("");
    const { error } = await supabase.from("video_comments").insert({
      video_id: video.id,
      user_id: user.id,
      content: content || (media?.type === "sticker" ? "Autocollant" : "GIF"),
      parent_id: replyingTo?.id ?? null,
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
    });
    if (error) toast.error(error.message);
    else {
      void logPositiveAction({ data: { videoId: video.id, action: "comment" } });
      void supabase.rpc("bump_quest_progress", {
        _metric_key: "conversation",
        _entity_id: video.id,
      });
    }
    setReplyingTo(null);
    setMedia(null);
    setShowExtras(false);
    setGifUrl("");
    await comments.refetch();
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }

  async function react(commentId: string, reaction: "like" | "dislike") {
    if (!user) return;
    const current = comments.data?.find((comment) => comment.id === commentId)?.my_reaction;
    if (current === reaction) {
      const { error } = await supabase
        .from("video_comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      if (error) {
        toast.error(t("errorGeneric"));
        return;
      }
    } else {
      const { error } = await supabase
        .from("video_comment_reactions")
        .upsert({ comment_id: commentId, user_id: user.id, reaction });
      if (error) {
        toast.error(t("errorGeneric"));
        return;
      }
    }
    await comments.refetch();
  }

  const total = comments.data?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="app-background flex h-[78dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-border shadow-[0_-24px_70px_-30px_rgba(0,0,0,.8)] sm:h-[82dvh] sm:rounded-[2rem] sm:border-b"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <label className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-purple-400/30 bg-purple-500/15 px-4 py-2.5 text-sm shadow-[0_10px_30px_-20px_rgba(168,85,247,.8)] focus-within:border-purple-500">
          <Search className="h-4 w-4 shrink-0 text-purple-500" />
          <span className="sr-only">{t("commentSearchTopic")}</span>
          <input
            value={commentSearch}
            onChange={(event) => setCommentSearch(event.target.value)}
            placeholder={video.caption || t("search")}
            className="min-w-0 flex-1 bg-transparent font-semibold text-purple-600 outline-none placeholder:text-purple-500/75 dark:text-purple-300"
          />
          {commentSearch ? (
            <button type="button" onClick={() => setCommentSearch("")} aria-label={t("cancel")}>
              <X className="h-4 w-4 text-purple-500" />
            </button>
          ) : null}
        </label>
        <div className="relative flex items-center justify-center border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={() => setSort((value) => (value === "popular" ? "recent" : "popular"))}
            className="flex items-center gap-2 text-base font-black"
            aria-label={t("changeCommentOrder")}
          >
            {total} {t("comments").toLocaleLowerCase()}
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-5 rounded-full p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {comments.data?.length ? (
            [...comments.data]
              .filter((comment) => !comment.parent_id)
              .filter((comment) => {
                const query = commentSearch.trim().toLocaleLowerCase();
                return (
                  !query ||
                  comment.content.toLocaleLowerCase().includes(query) ||
                  comment.username.toLocaleLowerCase().includes(query)
                );
              })
              .sort((a, b) =>
                sort === "popular"
                  ? b.likes_count - a.likes_count
                  : Date.parse(b.created_at) - Date.parse(a.created_at),
              )
              .map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  replies={comments.data.filter((r) => r.parent_id === c.id)}
                  onReply={(id, username) => {
                    setReplyingTo({ id, username });
                    setText(`@${username} `);
                  }}
                  onReact={react}
                />
              ))
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("firstComment")}</p>
          )}
        </div>
        {showExtras ? (
          <div className="border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
            <div className="flex gap-2">
              <input
                value={gifUrl}
                onChange={(e) => setGifUrl(e.target.value)}
                placeholder="Colle le lien d’un GIF"
                className="h-10 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-primary"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (gifUrl.trim()) setMedia({ url: gifUrl.trim(), type: "gif" });
                }}
              >
                Ajouter
              </Button>
            </div>
            <div className="mt-3 flex gap-2 text-3xl">
              {["🔥", "😂", "💙", "🎮", "👀", "🏆"].map((s) => (
                <button
                  key={s}
                  onClick={() => setMedia({ url: s, type: "sticker" })}
                  className="rounded-xl bg-background p-2 transition active:scale-90"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {replyingTo || media ? (
          <div className="flex items-center justify-between border-t border-border bg-primary/10 px-4 py-2 text-xs">
            <span>
              {replyingTo
                ? `Réponse à @${replyingTo.username}`
                : media?.type === "gif"
                  ? "GIF ajouté"
                  : `Autocollant ${media?.url}`}
            </span>
            <button
              onClick={() => {
                setReplyingTo(null);
                setMedia(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <StoredImage
            path={myProfile.data?.avatar_url}
            alt={myProfile.data?.username ?? ""}
            fallback={myProfile.data?.username?.[0]?.toUpperCase() ?? "?"}
            className="h-10 w-10 shrink-0 rounded-full"
          />
          <div className="flex min-w-0 flex-1 items-center rounded-full bg-surface-2 px-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("addComment")}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button type="button" className="p-1.5" aria-label="Mentionner quelqu’un">
              <AtSign className="h-5 w-5" />
            </button>
            <button type="button" className="p-1.5" aria-label="Ajouter un emoji">
              <Smile className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => setShowExtras((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full text-primary"
            aria-label="GIF et autocollants"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <Button size="icon" onClick={send} aria-label="Envoyer" disabled={!text.trim() && !media}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

type RichComment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  media_url: string | null;
  media_type: string | null;
  username: string;
  avatar_url: string | null;
  likes_count: number;
  dislikes_count: number;
  my_reaction: string | null;
};

function commentAge(value: string, lang: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "narrow" });
  if (seconds < 60) return formatter.format(0, "second");
  if (seconds < 3600) return formatter.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return formatter.format(-Math.floor(seconds / 3600), "hour");
  return formatter.format(-Math.floor(seconds / 86400), "day");
}

function CommentItem({
  comment,
  replies,
  onReply,
  onReact,
}: {
  comment: RichComment;
  replies: RichComment[];
  onReply: (id: string, username: string) => void;
  onReact: (id: string, reaction: "like" | "dislike") => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [gifting, setGifting] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Link to="/users/$id" params={{ id: comment.username || comment.user_id }}>
          <StoredImage
            path={comment.avatar_url}
            alt={comment.username}
            className="h-10 w-10 shrink-0 rounded-full"
            fallback={comment.username[0]?.toUpperCase() ?? "?"}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/users/$id"
            params={{ id: comment.username || comment.user_id }}
            className="text-xs font-bold text-muted-foreground hover:text-primary"
          >
            @{comment.username}
          </Link>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground">
            <MentionText text={comment.content} />
          </p>
          {comment.media_type === "gif" && comment.media_url ? (
            <img
              src={comment.media_url}
              alt="GIF"
              className="mt-2 max-h-44 rounded-2xl object-cover"
            />
          ) : null}
          {comment.media_type === "sticker" && comment.media_url ? (
            <span className="mt-2 block text-5xl">{comment.media_url}</span>
          ) : null}
          <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
            <span>{commentAge(comment.created_at, lang)}</span>
            <button
              onClick={() => onReply(comment.id, comment.username)}
              className="hover:text-primary"
            >
              {t("reply")}
            </button>
            {user && user.id !== comment.user_id ? (
              <button
                onClick={() => setGifting(true)}
                aria-label={t("giftTo", { username: comment.username })}
                className="flex items-center gap-1 hover:text-primary"
              >
                <Gift className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex w-9 shrink-0 flex-col items-center gap-3 pt-2 text-muted-foreground">
          <button
            onClick={() => void onReact(comment.id, "like")}
            className={cn("flex flex-col items-center text-purple-500 transition active:scale-90")}
            aria-label="J’aime"
          >
            <Heart className={cn("h-6 w-6", comment.my_reaction === "like" && "fill-current")} />
            <span className="text-[11px]">{comment.likes_count || ""}</span>
          </button>
          <button
            onClick={() => void onReact(comment.id, "dislike")}
            className={cn(comment.my_reaction === "dislike" && "text-primary")}
            aria-label="Je n’aime pas"
          >
            <ThumbsDown className="h-5 w-5" />
          </button>
        </div>
      </div>
      {replies.map((r) => (
        <div key={r.id} className="ml-12 flex gap-2 pl-3">
          <Link to="/users/$id" params={{ id: r.username || r.user_id }}>
            <StoredImage
              path={r.avatar_url}
              alt={r.username}
              className="h-8 w-8 rounded-full"
              fallback={r.username[0] ?? "?"}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to="/users/$id"
              params={{ id: r.username || r.user_id }}
              className="text-[11px] font-bold text-muted-foreground"
            >
              @{r.username}
            </Link>
            <p className="text-sm">
              <MentionText text={r.content} />
            </p>
            {r.media_type === "gif" && r.media_url ? (
              <img src={r.media_url} alt="GIF" className="mt-1 max-h-32 rounded-xl" />
            ) : null}
            {r.media_type === "sticker" && r.media_url ? (
              <span className="block text-4xl">{r.media_url}</span>
            ) : null}
            <div className="mt-1.5 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
              <span>{commentAge(r.created_at, lang)}</span>
              <button
                onClick={() => onReply(comment.id, r.username)}
                className="hover:text-primary"
              >
                {t("reply")}
              </button>
            </div>
          </div>
          <button
            onClick={() => void onReact(r.id, "like")}
            className="flex w-9 shrink-0 flex-col items-center pt-2 text-purple-500 transition active:scale-90"
            aria-label="J’aime"
          >
            <Heart className={cn("h-5 w-5", r.my_reaction === "like" && "fill-current")} />
            <span className="text-[11px]">{r.likes_count || ""}</span>
          </button>
        </div>
      ))}

      {gifting ? (
        <GiftSheet
          targetUserId={comment.user_id}
          targetUsername={comment.username}
          onClose={() => setGifting(false)}
        />
      ) : null}
    </div>
  );
}

function MentionText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(@[\w.]+)/g).map((part, index) =>
        part.startsWith("@") ? (
          <span key={index} className="font-bold text-sky-400">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
