import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Eye,
  Globe2,
  Hash,
  Heart,
  MessageCircle,
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
import { Button, Card, Input, Label } from "@/components/ui-kit";
import { uploadFile } from "@/lib/media";
import { useSignedUrl } from "@/components/Media";
import { ThumbnailPicker, VideoMontageEditor } from "@/components/VideoMontageEditor";
import { useI18n } from "@/lib/i18n";
import { getCreatorAnalytics } from "@/lib/creator-analytics.functions";
import { formatCount } from "./discover.index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/discover/studio")({
  head: () => ({ meta: [{ title: "Creator Studio - Bloxspark" }] }),
  component: StudioPage,
});

type Tab = "stats" | "videos" | "earnings";
type Point = { date: string; views: number; likes: number; retention: number };

function StudioPage() {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("stats");
  const [uploadOpen, setUploadOpen] = useState(false);
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
        </div>
      ) : null}
      {tab === "videos" ? (
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
      {uploadOpen ? <UploadWizard onClose={() => setUploadOpen(false)} onDone={refresh} /> : null}
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

const BOOST_TIERS = [
  { hours: 1, cost: 500 },
  { hours: 3, cost: 1000 },
  { hours: 6, cost: 1750 },
  { hours: 12, cost: 3000 },
  { hours: 24, cost: 5000 },
];

function VideoCard({
  video,
  onDeleted,
  onUpdated,
}: {
  video: {
    id: string;
    storage_path: string;
    thumbnail_path: string | null;
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
  const url = useSignedUrl(video.storage_path);
  const [busy, setBusy] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const isBoosted = !!video.boosted_until && new Date(video.boosted_until).getTime() > Date.now();

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
      {url ? (
        <video src={url} muted playsInline className="aspect-[9/16] w-full object-cover" />
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
          onClick={() => setBoosting(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-white/15 py-1.5 text-[11px] font-bold backdrop-blur"
        >
          🚀 {isBoosted ? t("studioExtendBoost") : t("studioBoost")}
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

      {boosting ? <BoostSheet videoId={video.id} onClose={() => setBoosting(false)} /> : null}
      {editing && url ? (
        <EditVideoSheet
          video={video}
          videoUrl={url}
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
  videoUrl: string;
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

          <div>
            <Label>{t("thumbnailTitle")}</Label>
            <ThumbnailPicker source={videoUrl} onPick={setThumbnailBlob} />
          </div>

          <Button className="w-full" size="lg" disabled={saving} onClick={() => void save()}>
            {saving ? t("studioPublishing") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Spends Blox to extend videos.boosted_until - a real visibility-weighting
 * flag elsewhere in the feed/algorithm, never a fabricated like/view/follow
 * count. */
function BoostSheet({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [buying, setBuying] = useState<number | null>(null);

  async function buy(hours: number, cost: number) {
    setBuying(hours);
    try {
      const { error } = await supabase.rpc("boost_video", {
        _video: videoId,
        _blox_cost: cost,
        _hours: hours,
      });
      if (error) throw error;
      toast.success(t("studioBoostSuccess", { hours }));
      await qc.invalidateQueries({ queryKey: ["my-videos"] });
      await qc.invalidateQueries({ queryKey: ["blox-balance"] });
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("insufficient_balance")
          ? t("studioBoostInsufficientBalance")
          : t("errorGeneric"),
      );
    } finally {
      setBuying(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-black">🚀 {t("studioBoostMyVideo")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("studioBoostDescription")}</p>
        <div className="mt-4 space-y-2">
          {BOOST_TIERS.map((tier) => (
            <button
              key={tier.hours}
              onClick={() => void buy(tier.hours, tier.cost)}
              disabled={buying !== null}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold transition hover:border-primary/40 disabled:opacity-50"
            >
              <span>{tier.hours}h</span>
              <span className="flex items-center gap-1 text-primary">
                {buying === tier.hours ? "…" : `${tier.cost.toLocaleString()} Blox`}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

const WIZARD_TOTAL_STEPS = 5;

function UploadWizard({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = useState<File | null>(null);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "sparks">("public");
  const [busy, setBusy] = useState(false);
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
  }
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
      const thumbnailPath = thumbnailBlob
        ? await uploadFile("thumbnails", user.id, thumbnailBlob, "jpg")
        : null;
      const { data: inserted, error } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          storage_path: path,
          thumbnail_path: thumbnailPath,
          caption: title.trim(),
          sound_name: null,
          hashtags,
          visibility,
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
      onDone();
    } catch (error) {
      if (error instanceof Error && error.message.includes("pending_video_exists")) {
        toast.error(t("studioPendingVideoBlocked"));
      } else {
        toast.error(error instanceof Error ? error.message : t("studioPublishFailed"));
      }
    } finally {
      setBusy(false);
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
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
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
          <button onClick={onClose} className="grid h-9 w-9 place-items-center">
            <X />
          </button>
        </header>
        <div className="grid grid-cols-5 gap-2 px-5 pt-4">
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
                  <video src={preview} muted playsInline className="max-h-[48dvh]" />
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                    {t("studioChangeVideo")}
                  </span>
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
          {step === 3 && file ? (
            <section>
              <h2 className="text-2xl font-black">{t("thumbnailTitle")}</h2>
              <ThumbnailPicker source={editedBlob ?? file} onPick={setThumbnailBlob} />
            </section>
          ) : null}
          {step === 4 ? (
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
            </section>
          ) : null}
          {step === 5 ? (
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
                  <Button variant="outline" onClick={addTag}>
                    {t("studioAdd")}
                  </Button>
                </div>
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
        </main>
        {step === 2 ? null : (
          <footer className="border-t border-border p-5">
            {step < 5 ? (
              <Button
                className="w-full"
                size="lg"
                disabled={(step === 1 && !file) || (step === 4 && !title.trim())}
                onClick={() => setStep((step + 1) as 2 | 3 | 4 | 5)}
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
    </div>
  );
}

function formatWatchTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? seconds + "s" : Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
}
