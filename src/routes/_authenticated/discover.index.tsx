import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Bookmark,
  AtSign,
  ChevronDown,
  ChevronLeft,
  ChevronsDown,
  ChevronUp,
  Check,
  EyeOff,
  Eye,
  Flag,
  Gauge,
  Gift,
  Heart,
  HeartCrack,
  ImagePlus,
  Link2,
  MessageCircle,
  MessageSquareOff,
  MoreHorizontal,
  Music2,
  Pin,
  PinOff,
  Play,
  Plus,
  RefreshCw,
  Reply,
  Repeat2,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSignedUrl, StoredImage, VideoThumb } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { GiftSheet } from "@/components/GiftSheet";
import { Button, Sheet } from "@/components/ui-kit";
import { cn, errorMessage } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import { discoverFeedKey, fetchDiscoverFeed, type VideoRow } from "@/lib/discover-feed";
import { uploadFile } from "@/lib/media";
import { notifyNewMessage } from "@/lib/messages.functions";
import {
  logPositiveAction,
  logVideoWatch,
  markNotInterested,
  resetRecommendations,
} from "@/lib/recommendation.functions";

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

const REPORT_SCENARIOS = [
  "violence",
  "hate",
  "suicide",
  "nudity",
  "graphic",
  "fraud",
  "personal_info",
  "intellectual_property",
  "other",
] as const;

const COMMENT_EMOJIS = ["😀", "😂", "🥰", "😎", "😭", "🔥", "✨", "💖", "👀", "😢", "🙏", "💯"];

/** Shared between the video and comment report sheets - same taxonomy either way. */
function reportScenarioLabels(
  t: (key: string) => string,
): Record<(typeof REPORT_SCENARIOS)[number], string> {
  return {
    violence: t("reportScenarioViolence"),
    hate: t("reportScenarioHate"),
    suicide: t("reportScenarioSuicide"),
    nudity: t("reportScenarioNudity"),
    graphic: t("reportScenarioGraphic"),
    fraud: t("reportScenarioFraud"),
    personal_info: t("reportScenarioPersonalInfo"),
    intellectual_property: t("reportScenarioIP"),
    other: t("reportScenarioOther"),
  };
}

export const Route = createFileRoute("/_authenticated/discover/")({
  validateSearch: (search: Record<string, unknown>): { v?: string; c?: string } => ({
    ...(typeof search["v"] === "string" ? { v: search["v"] } : {}),
    // Present (any value) when arriving from an "Activités" notification
    // about a comment - auto-opens that video's comments sheet.
    ...(typeof search["c"] === "string" ? { c: search["c"] } : {}),
  }),
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

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}

function DiscoverPage() {
  const { user } = useSession();
  const { t } = useI18n();
  const { v: pinnedVideoId, c: openCommentsFor } = Route.useSearch();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [muted, setMuted] = useState(
    () => window.localStorage.getItem("bloxspark-discover-muted") === "true",
  );
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    const saved = Number(window.localStorage.getItem("bloxspark-discover-speed"));
    return SPEED_OPTIONS.includes(saved as (typeof SPEED_OPTIONS)[number]) ? saved : 1;
  });
  const [autoScroll, setAutoScroll] = useState(
    () => window.localStorage.getItem("bloxspark-discover-autoscroll") === "true",
  );
  useEffect(() => {
    window.localStorage.setItem("bloxspark-discover-speed", String(playbackSpeed));
  }, [playbackSpeed]);
  useEffect(() => {
    window.localStorage.setItem("bloxspark-discover-autoscroll", String(autoScroll));
  }, [autoScroll]);
  const [comments, setComments] = useState<VideoRow | null>(null);
  const [resettingAlgo, setResettingAlgo] = useState(false);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [spotlight, setSpotlight] = useState<{
    video: VideoRow;
    username: string;
    avatar: string | null;
    verified: boolean | null;
  } | null>(null);

  const following = useQuery({
    queryKey: ["following", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      return (data ?? []).map((r) => r.following_id);
    },
  });

  const feed = useQuery({
    queryKey: discoverFeedKey(user?.id, tab, following.data, pinnedVideoId),
    enabled: !!user && following.isFetched,
    // Cached feed renders instantly when coming back to Discover instead of
    // showing a spinner every time - it still refreshes quietly in the
    // background once this goes stale. Shares fetchDiscoverFeed with the
    // bottom nav's prefetch-on-hover (src/lib/discover-feed.ts) so a tap on
    // the Discover tab often lands on already-warm cache.
    staleTime: 30_000,
    queryFn: () =>
      fetchDiscoverFeed({
        userId: user!.id,
        tab,
        followingIds: following.data ?? [],
        ...(pinnedVideoId ? { pinnedVideoId } : {}),
      }),
  });

  async function resetAlgorithm() {
    if (!confirm(t("feedResetConfirm"))) return;
    setResettingAlgo(true);
    try {
      await resetRecommendations();
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      toast.success(t("feedResetDone"));
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setResettingAlgo(false);
    }
  }

  // Deep-linked from an "Activités" notification about a comment - open
  // that video's comments sheet as soon as it's loaded.
  useEffect(() => {
    if (!openCommentsFor || !pinnedVideoId || openCommentsFor !== pinnedVideoId) return;
    const video = feed.data?.videos.find((v) => v.id === pinnedVideoId);
    if (video) setComments(video);
  }, [openCommentsFor, pinnedVideoId, feed.data]);

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
          .eq("moderation_status", "approved")
          .ilike("caption", `%${query}%`)
          .order("views_count", { ascending: false })
          .limit(12),
      ]);
      const creatorIds = [...new Set((foundVideos ?? []).map((video) => video.user_id))];
      const { data: videoCreators } = creatorIds.length
        ? await supabase
            .from("profiles")
            .select("id,username,avatar_url,verified")
            .in("id", creatorIds)
        : {
            data: [] as {
              id: string;
              username: string | null;
              avatar_url: string | null;
              verified: boolean | null;
            }[],
          };
      const creatorById = new Map((videoCreators ?? []).map((creator) => [creator.id, creator]));
      return {
        creators: creators ?? [],
        videos: ((foundVideos ?? []) as VideoRow[]).map((video) => ({
          video,
          username: creatorById.get(video.user_id)?.username ?? t("someone"),
          avatar: creatorById.get(video.user_id)?.avatar_url ?? null,
          verified: creatorById.get(video.user_id)?.verified ?? null,
        })),
      };
    },
  });

  const videos = feed.data?.videos ?? [];
  const displayedVideos = spotlight
    ? [spotlight.video, ...videos.filter((video) => video.id !== spotlight.video.id)]
    : videos;

  return (
    <div className="relative h-[calc(100dvh-6.5rem-env(safe-area-inset-bottom))] w-full overflow-hidden bg-background lg:h-dvh">
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
        <div className="relative grid h-full place-items-center overflow-hidden bg-[#07040d] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(168,85,247,.22),transparent_38%)]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border border-primary/10" />
          <div className="relative flex flex-col items-center">
            <div className="relative grid h-24 w-24 place-items-center">
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/10 border-t-primary border-r-fuchsia-400 shadow-[0_0_34px_rgba(168,85,247,.35)]" />
              <span className="absolute inset-3 animate-[spin_1.4s_linear_infinite_reverse] rounded-full border-2 border-white/5 border-b-violet-300" />
              <span className="spark-gradient grid h-12 w-12 place-items-center rounded-2xl text-xl font-black text-white shadow-[0_0_24px_rgba(168,85,247,.55)]">
                B
              </span>
            </div>
            <p className="mt-6 text-sm font-black tracking-wide">{t("loading")}</p>
            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: `${index * 140}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
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
        <div
          ref={feedScrollRef}
          className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
        >
          {displayedVideos.map((video) => {
            const highlighted = spotlight?.video.id === video.id ? spotlight : null;
            return (
              <VideoSlide
                key={video.id}
                video={video}
                muted={muted}
                speed={playbackSpeed}
                onSpeedChange={setPlaybackSpeed}
                autoScroll={autoScroll}
                onToggleAutoScroll={() => setAutoScroll((v) => !v)}
                username={
                  highlighted?.username ??
                  feed.data?.profiles[video.user_id]?.username ??
                  t("someone")
                }
                avatar={
                  highlighted?.avatar ?? feed.data?.profiles[video.user_id]?.avatar_url ?? null
                }
                verified={
                  highlighted?.verified ?? feed.data?.profiles[video.user_id]?.verified ?? false
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
              <button
                onClick={() => void resetAlgorithm()}
                disabled={resettingAlgo}
                className="mx-auto flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {resettingAlgo ? t("feedResetting") : t("feedResetButton")}
              </button>
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
  videos: Array<{
    video: VideoRow;
    username: string;
    avatar: string | null;
    verified: boolean | null;
  }>;
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
            aria-label={t("cancel")}
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
  return (
    <div className="relative aspect-[9/12] bg-black">
      <VideoThumb
        storagePath={video.storage_path}
        thumbnailPath={video.thumbnail_path}
        className="h-full w-full"
      />
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
        <Eye className="h-3 w-3" /> {formatCount(video.views_count)}
      </span>
    </div>
  );
}

function VideoSlide({
  video,
  muted,
  speed,
  onSpeedChange,
  autoScroll,
  onToggleAutoScroll,
  username,
  avatar,
  verified,
  onComments,
  onNotInterested,
}: {
  video: VideoRow;
  muted: boolean;
  speed: number;
  onSpeedChange: (speed: number) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  username: string;
  avatar: string | null;
  verified?: boolean | null;
  onComments: () => void;
  onNotInterested: () => void;
}) {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Every slide in the feed mounts at once (needed for scroll-snap), but
  // only the ones actually near the screen should fetch anything - without
  // this, opening Discover fired signed-URL requests and 4 DB lookups
  // (liked/favorited/reposted/following) for all 30 videos simultaneously,
  // starving the one video someone's actually looking at. A generous
  // rootMargin preloads the next couple of slides so swiping still feels
  // instant, without loading the whole feed's data up front.
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || nearViewport) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setNearViewport(true);
      },
      { rootMargin: "150% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nearViewport]);
  const url = useSignedUrl(nearViewport ? video.storage_path : null);
  const posterUrl = useSignedUrl(nearViewport ? video.thumbnail_path : null);
  const [viewCount, setViewCount] = useState(video.views_count);
  const [sharing, setSharing] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewed = useRef(false);
  const isMine = user?.id === video.user_id;

  function openContextMenu(e: { preventDefault: () => void }) {
    e.preventDefault();
    setContextMenuOpen(true);
  }
  function startLongPress() {
    longPressTimer.current = setTimeout(() => setContextMenuOpen(true), 500);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }
  function restart() {
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play();
  }

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
    enabled: !!user && nearViewport,
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
  // When auto-scroll is on the video doesn't loop - it advances to the next
  // slide instead, so that "ended" isn't a replay.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onEnded = () => {
      if (autoScroll) {
        containerRef.current?.nextElementSibling?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        loopedRef.current = true;
      }
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [url, autoScroll]);

  // Playback speed set from the long-press/right-click video menu - applies
  // immediately, and re-applies whenever the <video> src (re)loads since the
  // browser resets playbackRate to 1 on a new source.
  useEffect(() => {
    const el = ref.current;
    if (el) el.playbackRate = speed;
  }, [speed, url]);

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
        void logPositiveAction({ data: { videoId: video.id, action: "favorite" } });
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
      <div
        className="relative aspect-[9/16] h-full max-h-full w-full max-w-full overflow-hidden bg-black lg:w-auto lg:rounded-2xl lg:shadow-2xl lg:shadow-black/60 lg:ring-1 lg:ring-white/10"
        onContextMenu={openContextMenu}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onTouchCancel={cancelLongPress}
      >
        {url ? (
          <video
            ref={ref}
            src={url}
            poster={posterUrl || undefined}
            autoPlay
            loop={!autoScroll}
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
            onClick={() => {
              if (!isMine) void logPositiveAction({ data: { videoId: video.id, action: "visit_profile" } });
            }}
            className="pointer-events-auto flex items-center gap-1 text-[15px] font-extrabold text-white drop-shadow hover:underline"
          >
            @{username}
            {verified ? <Verified className="h-4 w-4 shrink-0" /> : null}
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
              onClick={() => {
                if (!isMine) void logPositiveAction({ data: { videoId: video.id, action: "visit_profile" } });
              }}
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
      <VideoContextMenu
        open={contextMenuOpen}
        onClose={() => setContextMenuOpen(false)}
        videoId={video.id}
        speed={speed}
        onSpeedChange={onSpeedChange}
        autoScroll={autoScroll}
        onToggleAutoScroll={onToggleAutoScroll}
        onRestart={restart}
        onNotInterested={onNotInterested}
      />
    </div>
  );
}

/** Right-click (desktop) / long-press (mobile) menu on a video: playback
 * speed, auto-scroll-to-next toggle, "not interested", and reporting the
 * video with a specific scenario. */
function VideoContextMenu({
  open,
  onClose,
  videoId,
  speed,
  onSpeedChange,
  autoScroll,
  onToggleAutoScroll,
  onRestart,
  onNotInterested,
}: {
  open: boolean;
  onClose: () => void;
  videoId: string;
  speed: number;
  onSpeedChange: (speed: number) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onRestart: () => void;
  onNotInterested: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const [reporting, setReporting] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    if (!open) setReporting(false);
  }, [open]);

  const SCENARIO_LABELS = reportScenarioLabels(t);

  async function submitReport(reason: string) {
    if (!user || sendingReport) return;
    setSendingReport(true);
    const { error } = await supabase
      .from("reports")
      .insert({ reporter_id: user.id, video_id: videoId, reason });
    setSendingReport(false);
    if (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
      return;
    }
    toast.success(t("reportSubmitted"));
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose}>
      {reporting ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setReporting(false)}
              aria-label={t("back")}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold">{t("videoMenuReport")}</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{t("reportSelectScenario")}</p>
          <div className="space-y-1">
            {REPORT_SCENARIOS.map((reason) => (
              <button
                key={reason}
                disabled={sendingReport}
                onClick={() => void submitReport(reason)}
                className="flex w-full items-center rounded-2xl px-3 py-3 text-left text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
              >
                {SCENARIO_LABELS[reason]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="rounded-2xl px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="h-4 w-4 text-primary" /> {t("videoMenuSpeed")}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SPEED_OPTIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => onSpeedChange(value)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold transition",
                    speed === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground",
                  )}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onToggleAutoScroll}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
          >
            <ChevronsDown className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t("videoMenuAutoScroll")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("videoMenuAutoScrollDesc")}
              </span>
            </span>
            <span
              className={cn(
                "grid h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition",
                autoScroll ? "justify-end bg-primary" : "justify-start bg-surface-2",
              )}
            >
              <span className="block h-5 w-5 rounded-full bg-white shadow" />
            </span>
          </button>
          <button
            onClick={() => {
              onRestart();
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
          >
            <RotateCcw className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("videoMenuRestart")}</span>
          </button>
          <button
            onClick={() => {
              onNotInterested();
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
          >
            <HeartCrack className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("notInterested")}</span>
          </button>
          <button
            onClick={() => setReporting(true)}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
          >
            <Flag className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("videoMenuReport")}</span>
          </button>
        </div>
      )}
    </Sheet>
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
        content: `video:${video.id}`,
      });
      if (msgError) throw msgError;
      void notifyNewMessage({
        data: { conversationId: conversationId as string, kind: "text", content: `video:${video.id}` },
      });
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
  const [burst, setBurst] = useState(0);
  return (
    <button
      onClick={() => {
        setBurst((value) => value + 1);
        onClick();
      }}
      aria-label={label}
      className="group relative flex flex-col items-center gap-0.5 transition active:scale-90"
    >
      {active ? (
        <span key={burst} className="pointer-events-none absolute left-1/2 top-3 bx-reaction-burst">
          {Array.from({ length: 8 }).map((_, index) => (
            <i key={index} style={{ "--burst-index": index } as React.CSSProperties} />
          ))}
        </span>
      ) : null}
      <Icon
        className={cn(
          "h-[26px] w-[26px] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.5)] transition-transform duration-200",
          active && activeClass,
          active && "scale-110 bx-reaction-pop",
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
  const [media, setMedia] = useState<{
    url: string;
    type: "gif" | "sticker" | "custom_sticker" | "image";
  } | null>(null);
  const [sort, setSort] = useState<"popular" | "recent">("popular");
  const [commentSearch, setCommentSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    { id: string; username: string; avatar_url: string | null; isFriend: boolean }[]
  >([]);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<RichComment | null>(null);
  const [deletingComment, setDeletingComment] = useState<RichComment | null>(null);
  const [reportingComment, setReportingComment] = useState<RichComment | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [pending, setPending] = useState<(RichComment & { status: "sending" | "failed" }) | null>(
    null,
  );
  const [page, setPage] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Changing sort re-queries from scratch rather than re-sorting whatever
  // happened to already be paginated in.
  useEffect(() => {
    setPage(0);
  }, [sort]);

  function toggleReplies(commentId: string) {
    setExpandedReplies((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  const mentionMatch = /(?:^|\s)@([\w.]*)$/.exec(text);
  const mentionQuery = mentionMatch ? mentionMatch[1] : null;

  useEffect(() => {
    if (mentionQuery === null || !user) {
      setMentionSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data: matchRows } = await supabase
        .from("matches")
        .select("user_a,user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      const friendIds = new Set(
        (matchRows ?? []).map((m) => (m.user_a === user.id ? m.user_b : m.user_a)),
      );
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .ilike("username", `${mentionQuery}%`)
        .neq("id", user.id)
        .limit(20);
      const results = (data ?? [])
        .filter((p): p is typeof p & { username: string } => !!p.username)
        .map((p) => ({ ...p, isFriend: friendIds.has(p.id) }))
        .sort((a, b) => Number(b.isFriend) - Number(a.isFriend))
        .slice(0, 6);
      setMentionSuggestions(results);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [mentionQuery, user]);

  function pickMention(username: string) {
    setText((current) => current.replace(/(?:^|\s)@[\w.]*$/, (m) => `${m[0] === " " ? " " : ""}@${username} `));
    setMentionSuggestions([]);
  }

  const myStickers = useQuery({
    queryKey: ["my-stickers", user?.id],
    enabled: !!user && showExtras,
    queryFn: async () => {
      const { data } = await supabase
        .from("stickers")
        .select("id,storage_path")
        .eq("user_id", user!.id)
        .order("position");
      return data ?? [];
    },
  });
  const [giftingCreator, setGiftingCreator] = useState(false);

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

  const videoCreator = useQuery({
    queryKey: ["comment-video-creator", video.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", video.user_id)
        .maybeSingle();
      return data;
    },
  });

  const COMMENT_PAGE_SIZE = 20;
  const COMMENT_COLUMNS = "id,user_id,content,created_at,parent_id,media_url,media_type,likes_count";

  const videoMeta = useQuery({
    queryKey: ["comment-video-meta", video.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("allow_comments,pinned_comment_id")
        .eq("id", video.id)
        .maybeSingle();
      return {
        allowComments: data?.allow_comments ?? true,
        pinnedCommentId: data?.pinned_comment_id ?? null,
      };
    },
  });
  const commentsAllowed = { data: videoMeta.data?.allowComments, isLoading: videoMeta.isLoading };

  const commentCount = useQuery({
    queryKey: ["video-comments-count", video.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("video_comments")
        .select("id", { count: "exact", head: true })
        .eq("video_id", video.id);
      return count ?? 0;
    },
  });

  // Top-level comments are paginated (never the whole thread at once);
  // replies are fetched only for the top-level comments currently loaded,
  // and the creator's pinned comment is always included even if it would
  // otherwise fall outside the current page or a search match.
  const comments = useQuery({
    queryKey: ["video-comments", video.id, sort, page, commentSearch, videoMeta.data?.pinnedCommentId],
    queryFn: async (): Promise<{ rows: RichComment[]; hasMore: boolean }> => {
      const query = commentSearch.trim();
      const searching = query.length > 0;
      let topQuery = supabase
        .from("video_comments")
        .select(COMMENT_COLUMNS)
        .eq("video_id", video.id)
        .is("parent_id", null);
      topQuery = searching
        ? topQuery.ilike("content", `%${query}%`)
        : sort === "popular"
          ? topQuery
              .order("likes_count", { ascending: false })
              .order("created_at", { ascending: false })
          : topQuery.order("created_at", { ascending: false });
      if (!searching) topQuery = topQuery.range(0, (page + 1) * COMMENT_PAGE_SIZE);
      const { data: topRows } = await topQuery;
      const fetchedTop = topRows ?? [];
      const hasMore = !searching && fetchedTop.length > (page + 1) * COMMENT_PAGE_SIZE;
      const visibleTop = searching ? fetchedTop : fetchedTop.slice(0, (page + 1) * COMMENT_PAGE_SIZE);

      const pinnedId = videoMeta.data?.pinnedCommentId ?? null;
      let pinnedRow: (typeof visibleTop)[number] | null = null;
      if (pinnedId && !visibleTop.some((r) => r.id === pinnedId)) {
        const { data: pinned } = await supabase
          .from("video_comments")
          .select(COMMENT_COLUMNS)
          .eq("id", pinnedId)
          .maybeSingle();
        pinnedRow = pinned ?? null;
      }

      const topIds = [...visibleTop, ...(pinnedRow ? [pinnedRow] : [])].map((r) => r.id);
      const { data: replyRows } = topIds.length
        ? await supabase
            .from("video_comments")
            .select(COMMENT_COLUMNS)
            .in("parent_id", topIds)
            .order("created_at", { ascending: true })
        : { data: [] };

      const rows = [...(pinnedRow ? [pinnedRow] : []), ...visibleTop, ...(replyRows ?? [])];
      const ids = [...new Set([...rows.map((r) => r.user_id), video.user_id])];
      const people: Record<
        string,
        { username: string; avatar_url: string | null; verified: boolean }
      > = {};
      if (ids.length) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id,username,avatar_url,verified")
          .in("id", ids);
        for (const row of p ?? [])
          people[row.id] = {
            username: row.username ?? "joueur",
            avatar_url: row.avatar_url,
            verified: row.verified ?? false,
          };
      }
      // Only the current viewer's and the creator's own reactions are needed
      // now that likes_count is a stored, trigger-maintained column -
      // fetching every reaction row just to count them isn't necessary.
      const reactorIds = [...new Set([user?.id, video.user_id].filter((x): x is string => !!x))];
      const reactions: Array<{ comment_id: string; user_id: string; reaction: string }> = [];
      if (rows.length && reactorIds.length) {
        const { data: reactionRows } = await supabase
          .from("video_comment_reactions")
          .select("comment_id,user_id,reaction")
          .in(
            "comment_id",
            rows.map((row) => row.id),
          )
          .in("user_id", reactorIds);
        reactions.push(...(reactionRows ?? []));
      }
      const richRows: RichComment[] = rows.map((r) => ({
        ...r,
        username: people[r.user_id]?.username ?? "joueur",
        avatar_url: people[r.user_id]?.avatar_url ?? null,
        verified: people[r.user_id]?.verified ?? false,
        creator_liked: reactions.some(
          (reaction) =>
            reaction.comment_id === r.id &&
            reaction.user_id === video.user_id &&
            reaction.reaction === "like",
        ),
        creator_avatar_url: people[video.user_id]?.avatar_url ?? null,
        my_reaction:
          reactions.find(
            (reaction) => reaction.comment_id === r.id && reaction.user_id === user?.id,
          )?.reaction ?? null,
      }));
      return { rows: richRows, hasMore };
    },
  });

  const pinnedCommentId = videoMeta.data?.pinnedCommentId ?? null;

  // Live sync: another viewer's new comment, deletion, reply, or like on
  // this video shows up here without closing and reopening the sheet.
  useEffect(() => {
    const channel = supabase
      .channel(`video-comments-${video.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_comments",
          filter: `video_id=eq.${video.id}`,
        },
        () => {
          void comments.refetch();
          void commentCount.refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_comment_reactions" },
        () => void comments.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  // Infinite scroll: load the next page of top-level comments once the
  // sentinel at the bottom of the list comes into view.
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && comments.data?.hasMore && !comments.isFetching) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [comments.data?.hasMore, comments.isFetching]);

  // Optimistic send: the draft appears in the list right away (status
  // "sending"); a failure flips it to "failed" in place instead of losing
  // the text, and the input keeps its contents until the post actually
  // succeeds so a retry is just hitting send again.
  async function postComment(draft: RichComment) {
    setPending({ ...draft, status: "sending" });
    const { error } = await supabase.from("video_comments").insert({
      video_id: video.id,
      user_id: draft.user_id,
      content: draft.content,
      parent_id: draft.parent_id,
      media_url: draft.media_url,
      media_type: draft.media_type,
    });
    if (error) {
      setPending((current) => (current ? { ...current, status: "failed" } : current));
      return;
    }
    setPending(null);
    setText("");
    setReplyingTo(null);
    setMedia(null);
    setShowExtras(false);
    setEmojiOpen(false);
    setGifUrl("");
    void logPositiveAction({ data: { videoId: video.id, action: "comment" } });
    void supabase.rpc("bump_quest_progress", {
      _metric_key: "conversation",
      _entity_id: video.id,
    });
    await comments.refetch();
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }

  function send() {
    const content = text.trim();
    if ((!content && !media) || !user || pending?.status === "sending") return;
    void postComment({
      id: `pending-${Date.now()}`,
      user_id: user.id,
      content:
        content ||
        (media?.type === "sticker" || media?.type === "custom_sticker"
          ? "Autocollant"
          : media?.type === "image"
            ? "Photo"
            : "GIF"),
      created_at: new Date().toISOString(),
      parent_id: replyingTo?.id ?? null,
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
      username: myProfile.data?.username ?? "",
      avatar_url: myProfile.data?.avatar_url ?? null,
      verified: false,
      likes_count: 0,
      creator_liked: false,
      creator_avatar_url: null,
      my_reaction: null,
    });
  }

  async function confirmDeleteComment() {
    if (!deletingComment) return;
    const id = deletingComment.id;
    setDeletingComment(null);
    const { error } = await supabase.from("video_comments").delete().eq("id", id);
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    await comments.refetch();
    await commentCount.refetch();
    await videoMeta.refetch();
    await qc.invalidateQueries({ queryKey: ["feed"] });
  }

  async function pickCommentImage(file: File) {
    if (!user) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = await uploadFile("comment-images", user.id, file, ext);
      setMedia({ url: path, type: "image" });
      setShowExtras(false);
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setUploadingImage(false);
    }
  }

  async function togglePin(comment: RichComment) {
    const nextId = pinnedCommentId === comment.id ? null : comment.id;
    const { error } = await supabase
      .from("videos")
      .update({ pinned_comment_id: nextId })
      .eq("id", video.id);
    setMenuFor(null);
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    await videoMeta.refetch();
    await comments.refetch();
  }

  async function submitCommentReport(reason: string) {
    if (!user || !reportingComment || sendingReport) return;
    setSendingReport(true);
    const { error } = await supabase
      .from("reports")
      .insert({
        reporter_id: user.id,
        comment_id: reportingComment.id,
        video_id: video.id,
        reason,
      });
    setSendingReport(false);
    setReportingComment(null);
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    toast.success(t("reportSubmitted"));
  }

  async function react(commentId: string) {
    if (!user) return;
    const current = comments.data?.rows.find((comment) => comment.id === commentId)?.my_reaction;
    if (current === "like") {
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
        .upsert({ comment_id: commentId, user_id: user.id, reaction: "like" });
      if (error) {
        toast.error(t("errorGeneric"));
        return;
      }
    }
    await comments.refetch();
  }

  const total = commentCount.data ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md bx-sheet-backdrop"
      onClick={onClose}
    >
      <div
        className={cn(
          "app-background relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[2.25rem] border border-b-0 border-primary/20 shadow-[0_-30px_100px_-25px_rgba(124,58,237,.65)] bx-comments-enter transition-[height] duration-300 ease-out sm:rounded-[2.25rem] sm:border-b",
          expanded ? "h-[94dvh] sm:h-[92dvh]" : "h-[58dvh] sm:h-[62dvh]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/10 to-transparent" />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t("collapseComments") : t("expandComments")}
          className="mx-auto mt-2 flex h-6 w-16 items-center justify-center active:scale-90"
        >
          <span className="h-1 w-11 rounded-full bg-primary/35" />
        </button>
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
            aria-label={t("cancel")}
            className="absolute right-5 rounded-full p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-5">
          {!commentsAllowed.isLoading && commentsAllowed.data === false ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
              <MessageSquareOff className="h-6 w-6" />
              {t("commentsDisabledMessage")}
            </div>
          ) : null}
          {pending && !pending.parent_id ? (
            <PendingCommentRow
              comment={pending}
              onRetry={() => void postComment(pending)}
              onDiscard={() => setPending(null)}
            />
          ) : null}
          {comments.data?.rows.length ? (
            <>
              {comments.data.rows
                .filter((comment) => !comment.parent_id)
                .map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    replies={comments.data!.rows.filter((r) => r.parent_id === c.id)}
                    isPinned={c.id === pinnedCommentId}
                    onReply={(id, username) => {
                      setReplyingTo({ id, username });
                      setText(`@${username} `);
                    }}
                    onReact={react}
                    onOpenMenu={setMenuFor}
                    expanded={expandedReplies.has(c.id)}
                    onToggleExpand={() => toggleReplies(c.id)}
                    pendingReply={pending?.parent_id === c.id ? pending : null}
                    onRetryPending={() => pending && void postComment(pending)}
                    onDiscardPending={() => setPending(null)}
                  />
                ))}
              <div ref={loadMoreRef} className="h-1" />
              {comments.isFetching && page > 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">{t("loading")}</p>
              ) : null}
            </>
          ) : !pending && commentsAllowed.data !== false && !comments.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("firstComment")}</p>
          ) : null}
        </div>
        {commentsAllowed.data === false ? null : (
        <>
        {showExtras ? (
          <div className="border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void pickCommentImage(file);
              }}
            />
            <button
              type="button"
              disabled={uploadingImage}
              onClick={() => imageInputRef.current?.click()}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-input py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              {uploadingImage ? t("loading") : t("commentPickImage")}
            </button>
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
            {(myStickers.data ?? []).length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {myStickers.data!.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setMedia({ url: s.storage_path, type: "custom_sticker" })}
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-background p-1 transition active:scale-90"
                  >
                    <CommentStickerThumb path={s.storage_path} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {emojiOpen ? (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-border bg-card/95 px-4 py-3 text-2xl backdrop-blur-xl">
            {COMMENT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setText((v) => v + emoji)}
                className="shrink-0 rounded-xl p-1.5 transition active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        {replyingTo || media ? (
          <div className="flex items-center justify-between border-t border-border bg-primary/10 px-4 py-2 text-xs">
            <span className="flex items-center gap-2">
              {media?.type === "image" ? (
                <CommentStickerThumb path={media.url} className="h-9 w-9 rounded-lg object-cover" />
              ) : null}
              {replyingTo
                ? `Réponse à @${replyingTo.username}`
                : media?.type === "gif"
                  ? "GIF ajouté"
                  : media?.type === "custom_sticker"
                    ? "Autocollant ajouté"
                    : media?.type === "image"
                      ? t("commentPickImage")
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
        {mentionSuggestions.length > 0 ? (
          <div className="mx-3 mb-1 space-y-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-lg">
            {mentionSuggestions.map((m) => (
              <button
                key={m.id}
                onClick={() => pickMention(m.username)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2"
              >
                <StoredImage
                  path={m.avatar_url}
                  alt=""
                  className="h-7 w-7 rounded-full"
                  fallback={m.username[0]?.toUpperCase() ?? "?"}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">@{m.username}</span>
                {m.isFriend ? (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {t("mentionFriendBadge")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="relative flex items-center gap-2 border-t border-primary/15 bg-card/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-15px_40px_-25px_rgba(124,58,237,.7)] backdrop-blur-2xl">
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
            <button
              type="button"
              onClick={() => setText((v) => (v.endsWith("@") || !v ? v + "@" : `${v} @`))}
              className="p-1.5"
              aria-label={t("commentMentionButton")}
            >
              <AtSign className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEmojiOpen((v) => !v);
                setShowExtras(false);
              }}
              className="p-1.5"
              aria-label={t("commentEmojiButton")}
            >
              <Smile className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={() => {
              setShowExtras((v) => !v);
              setEmojiOpen(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-full text-primary"
            aria-label={t("commentAttachButton")}
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          {user?.id !== video.user_id ? (
            <button
              onClick={() => setGiftingCreator(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-[0_6px_20px_-6px_rgba(168,85,247,.9)] transition hover:scale-105 active:scale-90"
              aria-label={t("giftTo", {
                username: videoCreator.data?.username ?? "creator",
              })}
            >
              <Gift className="h-5 w-5" />
            </button>
          ) : null}
          <Button
            size="icon"
            onClick={send}
            aria-label={t("send")}
            disabled={(!text.trim() && !media) || pending?.status === "sending"}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        </>
        )}
        {giftingCreator ? (
          <GiftSheet
            targetUserId={video.user_id}
            targetUsername={videoCreator.data?.username ?? "creator"}
            videoId={video.id}
            onGiftSent={() => void comments.refetch()}
            onClose={() => setGiftingCreator(false)}
          />
        ) : null}
      </div>
      {menuFor ? (
        <Sheet open onClose={() => setMenuFor(null)}>
          <div className="space-y-1">
            {video.user_id === user?.id && !menuFor.parent_id ? (
              <button
                onClick={() => void togglePin(menuFor)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
              >
                {pinnedCommentId === menuFor.id ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
                <span className="text-sm font-semibold">
                  {pinnedCommentId === menuFor.id ? t("commentMenuUnpin") : t("commentMenuPin")}
                </span>
              </button>
            ) : null}
            {menuFor.user_id === user?.id || video.user_id === user?.id ? (
              <button
                onClick={() => {
                  setDeletingComment(menuFor);
                  setMenuFor(null);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-destructive hover:bg-surface-2"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("delete")}</span>
              </button>
            ) : null}
            {menuFor.user_id !== user?.id ? (
              <button
                onClick={() => {
                  setReportingComment(menuFor);
                  setMenuFor(null);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
              >
                <Flag className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("videoMenuReport")}</span>
              </button>
            ) : null}
          </div>
        </Sheet>
      ) : null}
      {deletingComment ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setDeletingComment(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold">{t("commentDeleteConfirm")}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingComment(null)}>
                {t("cancel")}
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => void confirmDeleteComment()}>
                {t("delete")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {reportingComment ? (
        <Sheet open onClose={() => setReportingComment(null)}>
          <p className="mb-3 text-lg font-black">{t("videoMenuReport")}</p>
          <p className="mb-3 text-sm text-muted-foreground">{t("reportSelectScenario")}</p>
          <div className="space-y-1">
            {REPORT_SCENARIOS.map((reason) => (
              <button
                key={reason}
                disabled={sendingReport}
                onClick={() => void submitCommentReport(reason)}
                className="flex w-full items-center rounded-2xl px-3 py-3 text-left text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
              >
                {reportScenarioLabels(t)[reason]}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
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
  verified: boolean;
  likes_count: number;
  creator_liked: boolean;
  creator_avatar_url: string | null;
  my_reaction: string | null;
};

function CommentStickerThumb({ path, className }: { path: string; className?: string }) {
  const url = useSignedUrl(path);
  return url ? (
    <img src={url} alt="" className={cn("object-contain", className)} />
  ) : (
    <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} />
  );
}

function PendingCommentRow({
  comment,
  nested,
  onRetry,
  onDiscard,
}: {
  comment: RichComment & { status: "sending" | "failed" };
  nested?: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex gap-2 px-2 py-2", nested ? "ml-12 pl-3" : "gap-3")}>
      <StoredImage
        path={comment.avatar_url}
        alt={comment.username}
        className={cn(
          "shrink-0 rounded-full object-cover",
          nested ? "h-8 w-8" : "h-11 w-11",
          comment.status === "sending" && "opacity-50",
        )}
        fallback={comment.username[0]?.toUpperCase() ?? "?"}
      />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-bold text-muted-foreground">@{comment.username}</span>
        <p className={cn("text-sm text-foreground", comment.status === "sending" && "opacity-50")}>
          <MentionText text={comment.content} />
        </p>
        {comment.status === "sending" ? (
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="mt-1 flex items-center gap-3 text-xs font-bold">
            <span className="text-destructive">{t("commentSendFailed")}</span>
            <button onClick={onRetry} className="text-primary hover:underline">
              {t("retryAction")}
            </button>
            <button onClick={onDiscard} className="text-muted-foreground hover:underline">
              {t("cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  replies,
  isPinned,
  onReply,
  onReact,
  onOpenMenu,
  expanded,
  onToggleExpand,
  pendingReply,
  onRetryPending,
  onDiscardPending,
}: {
  comment: RichComment;
  replies: RichComment[];
  isPinned?: boolean;
  onReply: (id: string, username: string) => void;
  onReact: (id: string) => void;
  onOpenMenu: (comment: RichComment) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  pendingReply?: (RichComment & { status: "sending" | "failed" }) | null;
  onRetryPending: () => void;
  onDiscardPending: () => void;
}) {
  const { t } = useI18n();
  const [likeBurst, setLikeBurst] = useState(0);
  return (
    <div className="space-y-2 rounded-3xl px-2 py-3 transition-colors hover:bg-primary/[0.035]">
      <div className="flex gap-3">
        <Link to="/users/$id" params={{ id: comment.username || comment.user_id }}>
          <StoredImage
            path={comment.avatar_url}
            alt={comment.username}
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-background shadow-md"
            fallback={comment.username[0]?.toUpperCase() ?? "?"}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/users/$id"
            params={{ id: comment.username || comment.user_id }}
            className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary"
          >
            @{comment.username}
            {comment.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
          </Link>
          {isPinned ? (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
              <Pin className="h-3 w-3" />
              {t("commentPinnedBadge")}
            </span>
          ) : null}
          {comment.media_type === "gift" ? (
            <div className="mt-1 overflow-hidden rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-[1px] shadow-[0_10px_30px_-15px_rgba(217,70,239,.9)] bx-gift-comment">
              <div className="flex items-center gap-3 rounded-[calc(1rem-1px)] bg-black/20 px-3 py-2.5 text-white backdrop-blur-sm">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-xl shadow-inner">
                  🎁
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.16em] text-white/75">
                    Cadeau au créateur
                  </p>
                  <p className="text-base font-black">
                    {Number(comment.media_url ?? 0).toLocaleString()} Blox
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-[15px] leading-relaxed text-foreground">
              <MentionText text={comment.content} />
            </p>
          )}
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
          {comment.media_type === "custom_sticker" && comment.media_url ? (
            <CommentStickerThumb path={comment.media_url} className="mt-2 h-24 w-24" />
          ) : null}
          {comment.media_type === "image" && comment.media_url ? (
            <CommentStickerThumb
              path={comment.media_url}
              className="mt-2 max-h-52 w-full max-w-[220px] rounded-2xl object-cover"
            />
          ) : null}
          <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
            <span>{formatRelativeTime(comment.created_at, t)}</span>
            <button
              onClick={() => onReply(comment.id, comment.username)}
              className="hover:text-primary"
            >
              {t("reply")}
            </button>
            {comment.creator_liked ? (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-500">
                <span className="relative">
                  <StoredImage
                    path={comment.creator_avatar_url}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover"
                    fallback="♥"
                  />
                  <Heart className="absolute -bottom-1 -right-1 h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                </span>
                Aimé par le créateur
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex w-9 shrink-0 flex-col items-center gap-3 pt-2 text-muted-foreground">
          <button
            onClick={() => {
              setLikeBurst((value) => value + 1);
              void onReact(comment.id);
            }}
            className="group relative flex flex-col items-center text-muted-foreground transition active:scale-75"
            aria-label={t("like")}
          >
            {comment.my_reaction === "like" ? (
              <span key={likeBurst} className="bx-mini-heart-burst" />
            ) : null}
            <Heart
              className={cn(
                "h-6 w-6 transition",
                comment.my_reaction === "like" && "fill-rose-500 text-rose-500 bx-reaction-pop",
              )}
            />
            <span className="text-[11px]">{comment.likes_count || ""}</span>
          </button>
          <button
            onClick={() => onOpenMenu(comment)}
            className="text-muted-foreground transition hover:text-foreground"
            aria-label={t("commentMenuLabel")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
      {replies.length > 0 ? (
        <button
          onClick={onToggleExpand}
          className="ml-12 flex items-center gap-1 pl-3 text-xs font-bold text-muted-foreground hover:text-primary"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? t("hideReplies") : t("showRepliesCount", { count: replies.length })}
        </button>
      ) : null}
      {expanded
        ? replies.map((r) => (
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
            {r.media_type === "custom_sticker" && r.media_url ? (
              <CommentStickerThumb path={r.media_url} className="h-16 w-16" />
            ) : null}
            {r.media_type === "image" && r.media_url ? (
              <CommentStickerThumb
                path={r.media_url}
                className="mt-1 max-h-40 w-full max-w-[180px] rounded-xl object-cover"
              />
            ) : null}
            <div className="mt-1.5 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
              <span>{formatRelativeTime(r.created_at, t)}</span>
              <button
                onClick={() => onReply(comment.id, r.username)}
                className="hover:text-primary"
              >
                {t("reply")}
              </button>
            </div>
          </div>
          <div className="flex w-9 shrink-0 flex-col items-center gap-2 pt-2 text-muted-foreground">
            <button
              onClick={() => void onReact(r.id)}
              className="flex flex-col items-center transition active:scale-75"
              aria-label={t("like")}
            >
              <Heart
                className={cn(
                  "h-5 w-5",
                  r.my_reaction === "like" && "fill-rose-500 text-rose-500 bx-reaction-pop",
                )}
              />
              <span className="text-[11px]">{r.likes_count || ""}</span>
            </button>
            <button
              onClick={() => onOpenMenu(r)}
              className="transition hover:text-foreground"
              aria-label={t("commentMenuLabel")}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))
        : null}
      {pendingReply ? (
        <PendingCommentRow
          comment={pendingReply}
          nested
          onRetry={onRetryPending}
          onDiscard={onDiscardPending}
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
