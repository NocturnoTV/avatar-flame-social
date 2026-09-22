import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Crown,
  Eye,
  Globe2,
  Hash,
  Heart,
  MessageCircle,
  Music2,
  Pencil,
  Play,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  UsersRound,
  Video as VideoIcon,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Button, Card, Input, Label, Select, Sheet } from "@/components/ui-kit";
import { captureVideoThumbnail, uploadFile } from "@/lib/media";
import { StoredImage, useSignedUrl, VideoThumb } from "@/components/Media";
import { ThumbnailPicker, VideoMontageEditor } from "@/components/VideoMontageEditor";
import { SoundPicker, type PickedSound } from "@/components/SoundPicker";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { getCreatorAnalytics } from "@/lib/creator-analytics.functions";
import { TOPIC_CATEGORIES, type TopicCategory } from "@/lib/topicCategories";
import { formatCount } from "./discover.index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/discover/studio")({
  validateSearch: (search: Record<string, unknown>): { sound?: string } =>
    typeof search["sound"] === "string" ? { sound: search["sound"] } : {},
  head: () => ({ meta: [{ title: "Creator Studio - Bloxspark" }] }),
  component: StudioPage,
});

type Tab = "stats" | "videos" | "earnings";
type Point = { date: string; views: number; likes: number; retention: number };

function StudioPage() {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { sound: presetSoundId } = Route.useSearch();
  const [tab, setTab] = useState<Tab>("stats");
  const [uploadOpen, setUploadOpen] = useState(!!presetSoundId);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<VideoDraft | null>(null);
  const drafts = useQuery({
    queryKey: ["video-drafts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("video_drafts")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const presetSound = useQuery({
    queryKey: ["preset-sound", presetSoundId],
    enabled: !!presetSoundId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sounds")
        .select("id,storage_path,title")
        .eq("id", presetSoundId!)
        .maybeSingle();
      return data;
    },
  });
  const videos = useQuery({
    queryKey: ["my-videos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const followers = useQuery({
    queryKey: ["followers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", user!.id);
      return count ?? 0;
    },
  });
  const analytics = useQuery({
    queryKey: ["creator-analytics", user?.id],
    enabled: !!user,
    queryFn: () => getCreatorAnalytics(),
  });
  const rows = videos.data ?? [];
  const sum = (
    key:
      | "views_count"
      | "likes_count"
      | "comments_count"
      | "favorites_count"
      | "reposts_count"
      | "shares_count",
  ) => rows.reduce((total, video) => total + (video[key] ?? 0), 0);
  const views = sum("views_count");
  const likes = sum("likes_count");
  const interactions =
    likes +
    sum("comments_count") +
    sum("favorites_count") +
    sum("reposts_count") +
    sum("shares_count");
  const stats = [
    [t("studioTotalViews"), views, Eye],
    [t("studioUniqueViewers"), analytics.data?.uniqueViewers ?? 0, Users],
    [t("studioLikes"), likes, Heart],
    [t("comments"), sum("comments_count"), MessageCircle],
    [
      t("studioAvgRetention"),
      Math.round((analytics.data?.averageRetention ?? 0) * 100) + "%",
      TrendingUp,
    ],
    [
      t("studioCompletionRate"),
      Math.round((analytics.data?.completionRate ?? 0) * 100) + "%",
      Play,
    ],
    [t("studioAvgWatchTime"), formatWatchTime(analytics.data?.averageWatchMs ?? 0), Clock3],
    [t("followers"), followers.data ?? 0, UsersRound],
  ] as const;
  const refresh = () => {
    setUploadOpen(false);
    setTab("videos");
    void Promise.all([
      qc.invalidateQueries({ queryKey: ["my-videos"] }),
      qc.invalidateQueries({ queryKey: ["creator-analytics"] }),
      qc.invalidateQueries({ queryKey: ["feed"] }),
    ]);
  };
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:pb-12">
      <header className="mb-7 flex items-center gap-3">
        <Link
          to="/discover"
          aria-label={t("back")}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black">{t("creatorStudio")}</h1>
          <p className="text-sm text-muted-foreground">{t("studioSubtitle")}</p>
        </div>
        {drafts.data?.length ? (
          <Button variant="outline" onClick={() => setDraftsOpen(true)}>
            {t("studioDraftsButton", { count: drafts.data.length })}
          </Button>
        ) : null}
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">{t("publishVideo")}</span>
        </Button>
      </header>
      <nav className="mb-6 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["stats", t("studioTabAnalytics"), BarChart3],
            ["videos", t("studioTabContent"), VideoIcon],
            ["earnings", t("studioTabEarnings"), WalletCards],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold",
              tab === value ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
      {tab === "stats" ? (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(([label, value, Icon]) => (
              <Card key={label} className="p-4">
                <Icon className="mb-4 h-5 w-5 text-primary" />
                <p className="text-2xl font-black">
                  {typeof value === "number" ? formatCount(value) : value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </Card>
            ))}
          </section>
          <section className="grid gap-5 lg:grid-cols-2">
            <Chart
              title={t("studioTotalViews")}
              subtitle={t("studioLast14Days")}
              points={analytics.data?.daily ?? []}
              metric="views"
              color="#168bff"
            />
            <Chart
              title={t("studioAudienceRetention")}
              subtitle={t("studioAvgPercentWatched")}
              points={analytics.data?.daily ?? []}
              metric="retention"
              color="#8b5cf6"
              percent
            />
            <Chart
              title={t("studioLikes")}
              subtitle={t("studioLast14Days")}
              points={analytics.data?.daily ?? []}
              metric="likes"
              color="#ec4899"
            />
            <Card className="p-5">
              <p className="font-black">{t("studioPerformanceDetails")}</p>
              <div className="mt-5 space-y-4">
                <Progress
                  label={t("studioCompletedViews")}
                  value={(analytics.data?.completionRate ?? 0) * 100}
                />
                <Progress
                  label={t("studioSkippedEarly")}
                  value={(analytics.data?.skipRate ?? 0) * 100}
                />
                <p className="flex justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">{t("studioReplays")}</span>
                  <b>{formatCount(analytics.data?.replays ?? 0)}</b>
                </p>
                <p className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("studioEngagement")}</span>
                  <b>{views ? ((interactions / views) * 100).toFixed(1) : "0.0"}%</b>
                </p>
              </div>
            </Card>
          </section>
          {analytics.data?.isSparkPlus ? (
            <section className="grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <p className="flex items-center gap-1.5 font-black">
                  <Crown className="h-4 w-4 text-primary" /> {t("studioTrafficSources")}
                </p>
                <div className="mt-4 space-y-3">
                  {(
                    [
                      ["foryou", t("forYou")],
                      ["following", t("following")],
                      ["direct", t("studioTrafficDirect")],
                      ["other", t("studioTrafficOther")],
                    ] as const
                  ).map(([key, label]) => {
                    const sources = analytics.data?.trafficSources ?? {};
                    const total = Object.values(sources).reduce((a, b) => a + b, 0) || 1;
                    const count = sources[key] ?? 0;
                    return (
                      <Progress
                        key={key}
                        label={`${label} (${formatCount(count)})`}
                        value={(count / total) * 100}
                      />
                    );
                  })}
                </div>
              </Card>
              <Card className="p-5">
                <p className="flex items-center gap-1.5 font-black">
                  <Globe2 className="h-4 w-4 text-primary" /> {t("studioTopLanguages")}
                </p>
                <div className="mt-4 space-y-2">
                  {analytics.data?.topLanguages?.length ? (
                    analytics.data.topLanguages.map((l) => (
                      <p key={l.language} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {LANGUAGES.find((lg) => lg.code === l.language)?.flag ?? "🌐"}{" "}
                          {LANGUAGES.find((lg) => lg.code === l.language)?.label ?? l.language}
                        </span>
                        <b>{formatCount(l.count)}</b>
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("studioNoDataYet")}</p>
                  )}
                </div>
              </Card>
            </section>
          ) : (
            <Card className="relative overflow-hidden p-5 text-center">
              <Crown className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-2 font-black">{t("studioAdvancedStatsLocked")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("studioAdvancedStatsHint")}
              </p>
            </Card>
          )}
        </div>
      ) : null}
      {tab === "videos" ? (
        <>
        <MyCampaigns />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {!rows.length ? (
            <Card className="col-span-full py-14 text-center">
              <VideoIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-bold">{t("studioNoVideosYet")}</p>
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>
                {t("studioPostFirstVideo")}
              </Button>
            </Card>
          ) : (
            rows.map((video) => (
              <VideoCard key={video.id} video={video} onDeleted={refresh} onUpdated={refresh} />
            ))
          )}
        </div>
        </>
      ) : null}
      {tab === "earnings" ? (
        <Card className="relative overflow-hidden px-6 py-16 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-violet-500/10" />
          <div className="relative">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary text-white">
              <WalletCards className="h-8 w-8" />
            </span>
            <span className="mt-6 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[.2em] text-primary">
              {t("comingSoon")}
            </span>
            <h2 className="mt-4 text-3xl font-black">{t("studioCreatorEarnings")}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              {t("studioEarningsComingSoonText")}
            </p>
          </div>
        </Card>
      ) : null}
      {uploadOpen ? (
        <UploadWizard
          onClose={() => {
            setUploadOpen(false);
            setResumeDraft(null);
            void drafts.refetch();
          }}
          onDone={() => {
            setResumeDraft(null);
            refresh();
          }}
          {...(resumeDraft ? { draft: resumeDraft } : {})}
          {...(!resumeDraft && presetSound.data
            ? {
                presetSound: {
                  id: presetSound.data.id,
                  title: presetSound.data.title,
                  storagePath: presetSound.data.storage_path,
                },
              }
            : {})}
        />
      ) : null}

      <Sheet open={draftsOpen} onClose={() => setDraftsOpen(false)} title={t("studioDraftsTitle")}>
        <div className="space-y-2">
          {(drafts.data ?? []).map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setResumeDraft(d);
                setDraftsOpen(false);
                setUploadOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-border p-3.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <b className="block truncate">{d.title || t("studioUntitled")}</b>
                <small className="text-muted-foreground">
                  {new Date(d.updated_at).toLocaleDateString()}
                </small>
              </span>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await supabase.from("video_drafts").delete().eq("id", d.id);
                  void drafts.refetch();
                }}
                aria-label={t("delete")}
                className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </button>
          ))}
          {!drafts.data?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("studioNoDrafts")}
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

function Chart({
  title,
  subtitle,
  points,
  metric,
  color,
  percent = false,
}: {
  title: string;
  subtitle: string;
  points: Point[];
  metric: "views" | "likes" | "retention";
  color: string;
  percent?: boolean;
}) {
  const { t } = useI18n();
  const values = points.map((point) => point[metric]);
  const max = Math.max(1, ...values);
  const coords = values.map((value, index) => ({
    x: values.length < 2 ? 300 : (index / (values.length - 1)) * 600,
    y: 168 - (value / max) * 145,
  }));
  const line = coords.map((point) => point.x + "," + point.y).join(" ");
  const total = percent
    ? (values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)) * 100
    : values.reduce((a, b) => a + b, 0);
  return (
    <Card className="p-5">
      <div className="flex justify-between">
        <div>
          <h2 className="font-black">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <b style={{ color }}>{percent ? Math.round(total) + "%" : formatCount(total)}</b>
      </div>
      <svg viewBox="0 0 600 180" className="mt-5 h-44 w-full">
        {[45, 90, 135].map((y) => (
          <line
            key={y}
            x1="0"
            x2="600"
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity=".08"
            strokeDasharray="5 7"
          />
        ))}
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{t("studioDaysAgo14")}</span>
        <span>{t("studioToday")}</span>
      </div>
    </Card>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="mb-2 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <b>{Math.round(value)}%</b>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: Math.min(100, value) + "%" }}
        />
      </div>
    </div>
  );
}

function VideoCard({
  video,
  onDeleted,
  onUpdated,
}: {
  video: {
    id: string;
    storage_path: string | null;
    thumbnail_path: string | null;
    mux_playback_id?: string | null;
    mux_status?: string | null;
    caption: string | null;
    hashtags: string[] | null;
    views_count: number;
    likes_count: number;
    visibility: string;
    boosted_until: string | null;
  };
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const url = useSignedUrl(video.storage_path);
  const isMuxVideo = video.mux_status != null;
  const [busy, setBusy] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const isBoosted = !!video.boosted_until && new Date(video.boosted_until).getTime() > Date.now();

  // Self-heal: videos published before thumbnail capture was reliable (or
  // where it silently failed) render fine here from storage_path directly,
  // but show as a black tile everywhere else (Discover, reposts, other
  // people's feeds) since those never attempt the video-decode fallback at
  // scale. Backfill the missing thumbnail quietly the next time the owner
  // opens their own Studio page.
  useEffect(() => {
    // Mux generates its own thumbnails - this storage-frame-capture fallback
    // only applies to legacy Supabase-Storage-backed videos.
    if (!url || !user || video.thumbnail_path || isMuxVideo) return;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await fetch(url).then((r) => r.blob());
        const thumb = await captureVideoThumbnail(blob);
        if (!thumb || cancelled) return;
        const thumbnailPath = await uploadFile("thumbnails", user.id, thumb, "jpg");
        await supabase.from("videos").update({ thumbnail_path: thumbnailPath }).eq("id", video.id);
        if (!cancelled) onUpdated();
      } catch {
        // best-effort - the next visit to this page will just try again
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, video.thumbnail_path, video.id, user?.id]);

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("studioVideoDeleted"));
    onDeleted();
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
      {isMuxVideo ? (
        video.mux_status === "ready" && video.mux_playback_id ? (
          <VideoThumb storagePath={null} muxPlaybackId={video.mux_playback_id} className="aspect-[9/16] w-full" />
        ) : video.mux_status === "failed" ? (
          <div className="grid aspect-[9/16] w-full place-items-center bg-surface-2 text-center text-[11px] text-muted-foreground">
            {t("postVideoFailed")}
          </div>
        ) : (
          <div className="grid aspect-[9/16] w-full animate-pulse place-items-center bg-surface-2 text-center text-[11px] text-muted-foreground">
            {t("postVideoProcessing")}
          </div>
        )
      ) : url ? (
        <VideoThumb
          storagePath={video.storage_path}
          thumbnailPath={video.thumbnail_path}
          className="aspect-[9/16] w-full"
        />
      ) : (
        <div className="aspect-[9/16] animate-pulse bg-surface-2" />
      )}
      {isBoosted ? (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">
          🚀 {t("studioBoosted")}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10 text-white">
        <p className="truncate text-xs font-bold">{video.caption || t("studioUntitled")}</p>
        <p className="mt-1 text-[11px]">
          ◉ {formatCount(video.views_count)} · ♥ {formatCount(video.likes_count)}
        </p>
        <p className="mt-1 text-[10px] uppercase text-white/60">
          {video.visibility === "sparks" ? t("studioMySparks") : t("studioEveryone")}
        </p>
        <button
          onClick={() => setCampaignOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-white/15 py-1.5 text-[11px] font-bold backdrop-blur"
        >
          📢 {t("studioCreateCampaign")}
        </button>
      </div>
      <div className="absolute right-2 top-2 flex gap-1.5">
        <button
          onClick={() => setEditing(true)}
          aria-label={t("editVideo")}
          className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={remove}
          disabled={busy}
          aria-label={t("delete")}
          className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {campaignOpen ? (
        <CampaignSheet videoId={video.id} onClose={() => setCampaignOpen(false)} />
      ) : null}
      {editing && (url || isMuxVideo) ? (
        <EditVideoSheet
          video={video}
          videoUrl={url ?? null}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onUpdated();
          }}
        />
      ) : null}
    </div>
  );
}

function EditVideoSheet({
  video,
  videoUrl,
  onClose,
  onSaved,
}: {
  video: {
    id: string;
    caption: string | null;
    hashtags: string[] | null;
    visibility: string;
  };
  /** Null for a Mux-backed video - no signed Supabase Storage URL exists,
   * so the manual thumbnail-frame picker below is skipped (Mux generates
   * its own thumbnail); metadata editing still works either way. */
  videoUrl: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const [title, setTitle] = useState(video.caption ?? "");
  const [tag, setTag] = useState("");
  const [hashtags, setHashtags] = useState<string[]>(video.hashtags ?? []);
  const [visibility, setVisibility] = useState<"public" | "sparks">(
    video.visibility === "sparks" ? "sparks" : "public",
  );
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  function addTag() {
    const value = tag.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!value || hashtags.includes(value)) {
      setTag("");
      return;
    }
    if (hashtags.length >= 5) {
      toast.error(t("studioMaxHashtags"));
      return;
    }
    setHashtags((current) => [...current, value]);
    setTag("");
  }

  async function save() {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const thumbnailPath = thumbnailBlob
        ? await uploadFile("thumbnails", user.id, thumbnailBlob, "jpg")
        : undefined;
      const { error } = await supabase
        .from("videos")
        .update({
          caption: title.trim(),
          hashtags,
          visibility,
          ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
        })
        .eq("id", video.id);
      if (error) throw error;
      toast.success(t("videoUpdated"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-black">{t("editVideo")}</p>
          <button onClick={onClose} aria-label={t("cancel")}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <Label>{t("studioVideoTitleLabel")}</Label>
            <Input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12"
            />
          </div>

          <div>
            <Label>{t("studioHashtagsLabel", { count: hashtags.length })}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={tag}
                  disabled={hashtags.length >= 5}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="roblox"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={addTag}>
                {t("studioAdd")}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {hashtags.map((h) => (
                <button
                  key={h}
                  onClick={() => setHashtags((all) => all.filter((x) => x !== h))}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                >
                  #{h} ×
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t("studioVisibilityLabel")}</Label>
            <div className="mt-2 grid gap-2.5">
              {(
                [
                  ["public", t("studioEveryone"), Globe2],
                  ["sparks", t("studioMySparksOnly"), UsersRound],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  onClick={() => setVisibility(value)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3.5 text-left",
                    visibility === value ? "border-primary bg-primary/10" : "border-border",
                  )}
                >
                  <Icon className="h-4.5 w-4.5 text-primary" />
                  <span className="flex-1 text-sm font-semibold">{label}</span>
                  {visibility === value ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              ))}
            </div>
          </div>

          {videoUrl ? (
            <div>
              <Label>{t("thumbnailTitle")}</Label>
              <ThumbnailPicker source={videoUrl} onPick={setThumbnailBlob} />
            </div>
          ) : null}

          <Button className="w-full" size="lg" disabled={saving} onClick={() => void save()}>
            {saving ? t("studioPublishing") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

const AD_OBJECTIVES = [
  { value: "views", emoji: "👁️" },
  { value: "game_clicks", emoji: "🎮" },
  { value: "followers", emoji: "👥" },
  { value: "engagement", emoji: "💬" },
] as const;

/** Real budget-based sponsored campaign: objective, targeting, a fixed
 * per-impression cost server-side (ad_cost_per_impression), progressive
 * spend tracked in ad_campaigns.spent_blox as real viewers actually see the
 * video (charge_ad_impression, called from the feed), and an automatic
 * refund of whatever's left when the budget/duration runs out, the creator
 * stops it, or the video gets rejected by moderation. */
function CampaignSheet({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [objective, setObjective] = useState<(typeof AD_OBJECTIVES)[number]["value"]>("views");
  const [gameUrl, setGameUrl] = useState("");
  const [budget, setBudget] = useState(500);
  const [durationDays, setDurationDays] = useState(3);
  const [autoAudience, setAutoAudience] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState<string>(lang);
  const [targetCategories, setTargetCategories] = useState<TopicCategory[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function create() {
    if (objective === "game_clicks" && !gameUrl.trim()) {
      toast.error(t("studioCampaignGameUrlRequired"));
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.rpc("create_ad_campaign", {
        _video: videoId,
        _objective: objective,
        _game_url: objective === "game_clicks" ? gameUrl.trim() : "",
        _budget: budget,
        _duration_days: durationDays,
        _target_language: autoAudience ? "" : targetLanguage,
        _target_categories: autoAudience ? [] : targetCategories,
      });
      if (error) throw error;
      toast.success(t("studioCampaignCreated"));
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("insufficient_balance")
          ? t("studioBoostInsufficientBalance")
          : t("errorGeneric"),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-black">📢 {t("studioCreateCampaign")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("studioCampaignDescription")}</p>

        <p className="mt-4 text-xs font-black uppercase tracking-wide text-muted-foreground">
          {t("studioCampaignObjective")}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {AD_OBJECTIVES.map((o) => (
            <button
              key={o.value}
              onClick={() => setObjective(o.value)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-left text-xs font-bold",
                objective === o.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {o.emoji} {t(`studioCampaignObjective_${o.value}`)}
            </button>
          ))}
        </div>
        {objective === "game_clicks" ? (
          <Input
            value={gameUrl}
            onChange={(e) => setGameUrl(e.target.value)}
            placeholder="https://www.roblox.com/games/…"
            className="mt-2"
          />
        ) : null}

        <p className="mt-4 text-xs font-black uppercase tracking-wide text-muted-foreground">
          {t("studioCampaignBudget")}
        </p>
        <input
          type="range"
          min={100}
          max={10000}
          step={100}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
        <p className="text-sm font-bold text-primary">{budget.toLocaleString()} Blox</p>

        <p className="mt-4 text-xs font-black uppercase tracking-wide text-muted-foreground">
          {t("studioCampaignDuration")}
        </p>
        <div className="mt-2 flex gap-1.5">
          {[1, 2, 3, 5, 7].map((d) => (
            <button
              key={d}
              onClick={() => setDurationDays(d)}
              className={cn(
                "flex-1 rounded-xl border py-2 text-xs font-bold",
                durationDays === d
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {d}j
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-black uppercase tracking-wide text-muted-foreground">
          {t("studioCampaignAudience")}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setAutoAudience(true)}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-bold",
              autoAudience
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {t("studioCampaignAudienceAuto")}
          </button>
          <button
            onClick={() => setAutoAudience(false)}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-bold",
              !autoAudience
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {t("studioCampaignAudienceTargeted")}
          </button>
        </div>
        {!autoAudience ? (
          <Select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="mt-2"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </Select>
        ) : null}
        {!autoAudience ? (
          <>
            <p className="mt-3 text-xs font-black uppercase tracking-wide text-muted-foreground">
              {t("studioCampaignCategories")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TOPIC_CATEGORIES.map((cat) => {
                const selected = targetCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setTargetCategories((prev) =>
                        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {t(`studioCategory_${cat}`)}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <label className="mt-4 flex items-start gap-2.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            {t("boostTermsAccept")}{" "}
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="font-bold text-primary underline"
            >
              {t("boostTermsLink")}
            </button>
          </span>
        </label>

        <Button
          className="mt-4 w-full"
          disabled={creating || !termsAccepted}
          onClick={() => void create()}
        >
          {creating ? t("studioPublishing") : t("studioCampaignLaunch")}
        </Button>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground"
        >
          {t("cancel")}
        </button>
      </div>
      {termsOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setTermsOpen(false)}
        >
          <div
            className="max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-black">{t("boostTermsTitle")}</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {t("boostTermsBody")}
            </p>
            <button
              onClick={() => setTermsOpen(false)}
              className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Active sponsored campaigns, with real spend progress (ad_campaigns.spent_blox,
 * driven by real feed impressions - see charge_ad_impression) and a stop
 * button that refunds whatever's left immediately. */
function MyCampaigns() {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [stopping, setStopping] = useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: ["my-ad-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      await supabase.rpc("close_my_expired_ad_campaigns");
      const { data } = await supabase
        .from("ad_campaigns")
        .select("id,video_id,objective,budget_blox,spent_blox,ends_at,status")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function stop(id: string) {
    setStopping(id);
    try {
      await supabase.rpc("stop_ad_campaign", { _campaign: id });
      await qc.invalidateQueries({ queryKey: ["my-ad-campaigns"] });
      await qc.invalidateQueries({ queryKey: ["blox-balance"] });
      toast.success(t("studioCampaignStopped"));
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setStopping(null);
    }
  }

  if (!campaigns.data?.length) return null;

  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        {t("studioMyCampaigns")}
      </p>
      {campaigns.data.map((c) => (
        <Card key={c.id} className="p-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>{t(`studioCampaignObjective_${c.objective}`)}</span>
            <span className="text-muted-foreground">
              {c.spent_blox.toLocaleString()} / {c.budget_blox.toLocaleString()} Blox
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (c.spent_blox / c.budget_blox) * 100)}%` }}
            />
          </div>
          <button
            onClick={() => void stop(c.id)}
            disabled={stopping === c.id}
            className="mt-2 text-xs font-bold text-destructive disabled:opacity-50"
          >
            {t("studioCampaignStop")}
          </button>
        </Card>
      ))}
    </div>
  );
}

const WIZARD_TOTAL_STEPS = 8;

type VideoDraft = {
  id: string;
  title: string;
  hashtags: string[];
  visibility: string;
  sound_id: string | null;
  sound_title: string | null;
  allow_comments: boolean;
  allow_reactions: boolean;
  allow_sharing: boolean;
  allow_remix: boolean;
  sensitive_content: boolean;
  contains_paid_promotion: boolean;
  contains_ai_content: boolean;
};

function UploadWizard({
  onDone,
  onClose,
  presetSound,
  draft,
}: {
  onDone: () => void;
  onClose: () => void;
  presetSound?: PickedSound;
  draft?: VideoDraft;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const pendingVideo = useQuery({
    queryKey: ["has-pending-video", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("moderation_status", "pending");
      return (count ?? 0) > 0;
    },
  });
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);
  const [file, setFile] = useState<File | null>(null);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState(draft?.title ?? "");
  const [tag, setTag] = useState("");
  const [hashtags, setHashtags] = useState<string[]>(draft?.hashtags ?? []);
  const [visibility, setVisibility] = useState<"public" | "sparks">(
    draft?.visibility === "sparks" ? "sparks" : "public",
  );
  const [sound, setSound] = useState<PickedSound | null>(
    presetSound ??
      (draft?.sound_id
        ? { id: draft.sound_id, title: draft.sound_title ?? "", storagePath: "" }
        : null),
  );
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [allowComments, setAllowComments] = useState(draft?.allow_comments ?? true);
  const [allowReactions, setAllowReactions] = useState(draft?.allow_reactions ?? true);
  const [allowSharing, setAllowSharing] = useState(draft?.allow_sharing ?? true);
  const [allowRemix, setAllowRemix] = useState(draft?.allow_remix ?? true);
  const [sensitiveContent, setSensitiveContent] = useState(draft?.sensitive_content ?? false);
  const [containsPaidPromotion, setContainsPaidPromotion] = useState(
    draft?.contains_paid_promotion ?? false,
  );
  const [containsAiContent, setContainsAiContent] = useState(draft?.contains_ai_content ?? false);
  const [busy, setBusy] = useState(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  // The video's metadata (duration, dimensions) loads asynchronously after
  // choose() - moving on to trim/thumbnail steps before it's ready left them
  // unable to read a duration or capture a frame, looking broken rather
  // than just not-loaded-yet.
  const [videoReady, setVideoReady] = useState(false);
  const myProfile = useQuery({
    queryKey: ["upload-wizard-profile", user?.id],
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
  const [hashtagSuggestions, setHashtagSuggestions] = useState<{ tag: string; uses: number }[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; username: string }[]>(
    [],
  );
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function choose(selected: File | null) {
    if (!selected) return;
    if (selected.size > 200 * 1024 * 1024) {
      toast.error(t("studioMaxFileSize"));
      return;
    }
    setFile(selected);
    setEditedBlob(null);
    setThumbnailBlob(null);
    setVideoReady(false);
  }
  function addTag(explicit?: string) {
    const value = (explicit ?? tag).trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!value || hashtags.includes(value)) {
      setTag("");
      setHashtagSuggestions([]);
      return;
    }
    if (hashtags.length >= 5) {
      toast.error(t("studioMaxHashtags"));
      return;
    }
    setHashtags((current) => [...current, value]);
    setTag("");
    setHashtagSuggestions([]);
  }

  useEffect(() => {
    const prefix = tag.trim().replace(/^#+/, "");
    if (!prefix) {
      setHashtagSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.rpc("search_hashtags", { _prefix: prefix, _limit: 6 });
      setHashtagSuggestions(data ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tag]);

  const mentionQuery = useMemo(() => {
    const match = /(?:^|\s)@([\w.]*)$/.exec(title);
    return match ? match[1] : null;
  }, [title]);

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username")
        .ilike("username", `${mentionQuery}%`)
        .limit(6);
      setMentionSuggestions((data ?? []).filter((p): p is { id: string; username: string } => !!p.username));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mentionQuery]);

  function pickMention(username: string) {
    setTitle((current) => current.replace(/(?:^|\s)@[\w.]*$/, (m) => `${m[0] === " " ? " " : ""}@${username} `));
    setMentionSuggestions([]);
  }
  async function publish() {
    if (!file || !user || !title.trim()) return;
    setBusy(true);
    try {
      // New accounts' very first video is held for review (server-enforced,
      // see the enforce_first_video_moderation trigger - this count is only
      // to decide which success message to show, not to gate anything).
      const { count: existingVideoCount } = await supabase
        .from("videos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      // A montage edit (trim/text/sound) replaces the original file with a
      // re-encoded WebM - otherwise the original file goes up untouched.
      const uploadSource: Blob = editedBlob ?? file;
      const ext = editedBlob ? "webm" : file.name.split(".").pop() || "mp4";
      const path = await uploadFile("videos", user.id, uploadSource, ext);
      // No hand-picked thumbnail: capture one from the video itself, or the
      // feed tile stays black in the native app (WebViews don't paint
      // preload="metadata" frames).
      const effectiveThumbnail =
        thumbnailBlob ?? (await captureVideoThumbnail(uploadSource));
      const thumbnailPath = effectiveThumbnail
        ? await uploadFile("thumbnails", user.id, effectiveThumbnail, "jpg")
        : null;
      const { data: inserted, error } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          storage_path: path,
          thumbnail_path: thumbnailPath,
          caption: title.trim(),
          sound_id: sound?.id ?? null,
          sound_name: sound?.title ?? null,
          hashtags,
          visibility,
          allow_comments: allowComments,
          allow_reactions: allowReactions,
          allow_sharing: allowSharing,
          allow_remix: allowRemix,
          sensitive_content: sensitiveContent,
          contains_paid_promotion: containsPaidPromotion,
          contains_ai_content: containsAiContent,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted) {
        void supabase.rpc("bump_quest_progress", {
          _metric_key: "creator",
          _entity_id: inserted.id,
        });
      }
      if ((existingVideoCount ?? 0) === 0) {
        toast.success(t("studioFirstVideoPendingNotice"), { duration: 12000 });
      } else {
        toast.success(t("studioVideoPublished"));
      }
      if (draft) await supabase.from("video_drafts").delete().eq("id", draft.id);
      onDone();
    } catch (error) {
      const rateLimitMatch =
        error instanceof Error ? error.message.match(/rate_limited: (\d+)/) : null;
      if (error instanceof Error && error.message.includes("pending_video_exists")) {
        toast.error(t("studioPendingVideoBlocked"));
      } else if (rateLimitMatch) {
        toast.error(t("studioRateLimited", { minutes: rateLimitMatch[1]! }));
      } else {
        toast.error(error instanceof Error ? error.message : t("studioPublishFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  function requestClose() {
    if (file && !busy) setDraftPromptOpen(true);
    else onClose();
  }

  async function discardDraft() {
    if (draft) await supabase.from("video_drafts").delete().eq("id", draft.id);
    setDraftPromptOpen(false);
    onClose();
  }

  async function saveDraft() {
    if (!user) return;
    setSavingDraft(true);
    try {
      const values = {
        user_id: user.id,
        title: title.trim(),
        hashtags,
        visibility,
        sound_id: sound?.id ?? null,
        sound_title: sound?.title ?? null,
        allow_comments: allowComments,
        allow_reactions: allowReactions,
        allow_sharing: allowSharing,
        allow_remix: allowRemix,
        sensitive_content: sensitiveContent,
        contains_paid_promotion: containsPaidPromotion,
        contains_ai_content: containsAiContent,
      };
      if (draft) {
        await supabase.from("video_drafts").update(values).eq("id", draft.id);
      } else {
        await supabase.from("video_drafts").insert(values);
      }
      toast.success(t("studioDraftSaved"));
      setDraftPromptOpen(false);
      onClose();
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setSavingDraft(false);
    }
  }

  if (pendingVideo.data) {
    return (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-5">
        <div className="bx-pop w-full max-w-md rounded-t-[32px] border border-border bg-background p-6 text-center sm:rounded-[32px]">
          <p className="text-lg font-black">{t("studioPendingVideoBlockedTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("studioPendingVideoBlocked")}</p>
          <Button className="mt-5 w-full" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="bx-pop flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[32px] border border-border bg-background sm:rounded-[32px]">
        <header className="flex items-center border-b border-border px-5 py-4">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7)}
              className="grid h-9 w-9 place-items-center"
            >
              <ArrowLeft />
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}
          <div className="flex-1 text-center">
            <b>{t("publishVideo")}</b>
            <p className="text-xs text-muted-foreground">
              {t("studioStepOf", { step, total: WIZARD_TOTAL_STEPS })}
            </p>
          </div>
          <button onClick={requestClose} className="grid h-9 w-9 place-items-center">
            <X />
          </button>
        </header>
        <div className="grid grid-cols-7 gap-2 px-5 pt-4">
          {Array.from({ length: WIZARD_TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={cn("h-1.5 rounded-full", n <= step ? "bg-primary" : "bg-surface-2")}
            />
          ))}
        </div>
        <main className="overflow-y-auto px-5 py-6">
          {step === 1 ? (
            <section>
              <h2 className="text-2xl font-black">{t("studioChooseVideo")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("studioSelectVideoHint")}</p>
              <input
                ref={input}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => choose(e.target.files?.[0] ?? null)}
              />
              {preview ? (
                <button
                  onClick={() => input.current?.click()}
                  className="relative mx-auto mt-6 block overflow-hidden rounded-3xl bg-black"
                >
                  <video
                    src={preview}
                    muted
                    playsInline
                    onLoadedMetadata={(e) => {
                      setVideoReady(true);
                      e.currentTarget
                        .play()
                        .then(() => e.currentTarget.pause())
                        .catch(() => {});
                    }}
                    className="max-h-[48dvh]"
                  />
                  {!videoReady ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <p className="text-xs font-bold text-white">{t("studioProcessingVideo")}</p>
                    </div>
                  ) : (
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                      {t("studioChangeVideo")}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => input.current?.click()}
                  className="mt-6 flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 py-16"
                >
                  <Upload className="h-9 w-9 text-primary" />
                  <b>{t("studioSelectVideoFile")}</b>
                </button>
              )}
            </section>
          ) : null}
          {step === 2 && file ? (
            <VideoMontageEditor
              file={file}
              onDone={(blob) => {
                setEditedBlob(blob);
                setStep(3);
              }}
              onSkip={() => setStep(3)}
            />
          ) : null}
          {step === 3 ? (
            <section>
              <h2 className="text-2xl font-black">{t("chooseSoundTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("studioTitleHint")}</p>
              <button
                onClick={() => setSoundPickerOpen(true)}
                className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-left"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Music2 className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  {sound ? sound.title : t("noSoundSelected")}
                </span>
              </button>
              {sound ? (
                <button
                  onClick={() => setSound(null)}
                  className="mt-2 text-xs font-bold text-destructive"
                >
                  {t("removeSoundSelection")}
                </button>
              ) : null}
              <SoundPicker
                open={soundPickerOpen}
                onClose={() => setSoundPickerOpen(false)}
                onPick={(s) => {
                  setSound(s);
                  setSoundPickerOpen(false);
                }}
              />
            </section>
          ) : null}
          {step === 4 && file ? (
            <section>
              <h2 className="text-2xl font-black">{t("thumbnailTitle")}</h2>
              <ThumbnailPicker source={editedBlob ?? file} onPick={setThumbnailBlob} />
            </section>
          ) : null}
          {step === 5 ? (
            <section>
              <h2 className="text-2xl font-black">{t("studioGiveTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("studioTitleHint")}</p>
              <Label className="mt-7">{t("studioVideoTitleLabel")}</Label>
              <Input
                autoFocus
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("studioTitlePlaceholder")}
                className="h-14 text-base"
              />
              <p className="mt-2 text-right text-xs text-muted-foreground">{title.length}/120</p>
              {mentionSuggestions.length > 0 ? (
                <div className="mt-2 space-y-1 rounded-2xl border border-border bg-card p-1.5">
                  {mentionSuggestions.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => pickMention(m.username)}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-surface-2"
                    >
                      @{m.username}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">{t("studioMentionHint")}</p>
            </section>
          ) : null}
          {step === 6 ? (
            <section className="space-y-7">
              <div>
                <h2 className="text-2xl font-black">{t("studioHashtagsVisibility")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("studioHashtagsHint")}</p>
              </div>
              <div>
                <Label>{t("studioHashtagsLabel", { count: hashtags.length })}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={tag}
                      disabled={hashtags.length >= 5}
                      onChange={(e) => setTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="roblox"
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" onClick={() => addTag()}>
                    {t("studioAdd")}
                  </Button>
                </div>
                {hashtagSuggestions.length > 0 ? (
                  <div className="mt-2 space-y-0.5 rounded-2xl border border-border bg-card p-1.5">
                    {hashtagSuggestions.map((s) => (
                      <button
                        key={s.tag}
                        onClick={() => addTag(s.tag)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
                      >
                        <span className="font-bold">#{s.tag}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("studioHashtagUses", { count: s.uses })}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {hashtags.map((h) => (
                    <button
                      key={h}
                      onClick={() => setHashtags((all) => all.filter((x) => x !== h))}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                    >
                      #{h} ×
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("studioVisibilityLabel")}</Label>
                <div className="mt-2 grid gap-3">
                  {(
                    [
                      ["public", t("studioEveryone"), t("studioVisibleAcrossDiscover"), Globe2],
                      ["sparks", t("studioMySparksOnly"), t("studioOnlyFollowers"), UsersRound],
                    ] as const
                  ).map(([value, label, desc, Icon]) => (
                    <button
                      key={value}
                      onClick={() => setVisibility(value)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-4 text-left",
                        visibility === value ? "border-primary bg-primary/10" : "border-border",
                      )}
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="flex-1">
                        <b className="block">{label}</b>
                        <small className="text-muted-foreground">{desc}</small>
                      </span>
                      {visibility === value ? <Check className="h-5 w-5 text-primary" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          {step === 7 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-black">{t("studioPublishOptionsTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("studioPublishOptionsHint")}
                </p>
              </div>
              <PublishToggle
                label={t("studioAllowComments")}
                checked={allowComments}
                onChange={setAllowComments}
              />
              <PublishToggle
                label={t("studioAllowReactions")}
                checked={allowReactions}
                onChange={setAllowReactions}
              />
              <PublishToggle
                label={t("studioAllowSharing")}
                checked={allowSharing}
                onChange={setAllowSharing}
              />
              <PublishToggle
                label={t("studioAllowRemix")}
                checked={allowRemix}
                onChange={setAllowRemix}
              />
              <label className="flex items-center gap-2.5 rounded-2xl border border-border p-3.5 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={sensitiveContent}
                  onChange={(e) => setSensitiveContent(e.target.checked)}
                  className="h-4 w-4"
                />
                {t("studioSensitiveContent")}
              </label>
              <label className="flex items-center gap-2.5 rounded-2xl border border-border p-3.5 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={containsPaidPromotion}
                  onChange={(e) => setContainsPaidPromotion(e.target.checked)}
                  className="h-4 w-4"
                />
                {t("studioContainsPromotion")}
              </label>
              <label className="flex items-center gap-2.5 rounded-2xl border border-border p-3.5 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={containsAiContent}
                  onChange={(e) => setContainsAiContent(e.target.checked)}
                  className="h-4 w-4"
                />
                {t("studioContainsAiContent")}
              </label>
            </section>
          ) : null}
          {step === 8 ? (
            <section>
              <h2 className="text-2xl font-black">{t("studioPreviewTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("studioPreviewHint")}</p>
              <div className="relative mx-auto mt-5 aspect-[9/16] max-h-[52dvh] overflow-hidden rounded-3xl bg-black">
                {(preview || editedBlob) ? (
                  <video
                    src={editedBlob ? URL.createObjectURL(editedBlob) : preview!}
                    muted
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-white">
                  <div className="flex items-center gap-2">
                    <StoredImage
                      path={myProfile.data?.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full"
                      fallback={myProfile.data?.username?.[0]?.toUpperCase() ?? "?"}
                    />
                    <b className="text-sm">@{myProfile.data?.username ?? "moi"}</b>
                  </div>
                  {title ? <p className="mt-2 text-sm">{title}</p> : null}
                  {hashtags.length ? (
                    <p className="mt-1 text-sm text-white/80">
                      {hashtags.map((h) => `#${h}`).join(" ")}
                    </p>
                  ) : null}
                  {sound ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-white/70">
                      <Music2 className="h-3 w-3" /> {sound.title}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" /> 0
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" /> 0
                    </span>
                    <span className="flex items-center gap-1">
                      <Upload className="h-4 w-4" /> {t("studioShare")}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </main>
        {step === 2 ? null : (
          <footer className="border-t border-border p-5">
            {step < 8 ? (
              <Button
                className="w-full"
                size="lg"
                disabled={(step === 1 && (!file || !videoReady)) || (step === 5 && !title.trim())}
                onClick={() => setStep((step + 1) as 2 | 3 | 4 | 5 | 6 | 7 | 8)}
              >
                {t("continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="w-full" size="lg" disabled={busy} onClick={publish}>
                {busy ? t("studioPublishing") : t("publishVideo")}
              </Button>
            )}
          </footer>
        )}
      </div>

      {draftPromptOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-sm rounded-3xl bg-background p-5 text-center">
            <p className="text-lg font-black">{t("studioSaveDraftTitle")}</p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={savingDraft}
                onClick={() => void discardDraft()}
              >
                {t("delete")}
              </Button>
              <Button className="flex-1" disabled={savingDraft} onClick={() => void saveDraft()}>
                {savingDraft ? "…" : t("studioSaveDraft")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PublishToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border p-3.5 text-left"
      role="switch"
      aria-checked={checked}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "spark-gradient" : "bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[1.4rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function formatWatchTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? seconds + "s" : Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
}
