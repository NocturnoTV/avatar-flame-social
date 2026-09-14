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
    ["Total views", views, Eye],
    ["Unique viewers", analytics.data?.uniqueViewers ?? 0, Users],
    ["Likes", likes, Heart],
    ["Comments", sum("comments_count"), MessageCircle],
    [
      "Average retention",
      Math.round((analytics.data?.averageRetention ?? 0) * 100) + "%",
      TrendingUp,
    ],
    ["Completion rate", Math.round((analytics.data?.completionRate ?? 0) * 100) + "%", Play],
    ["Average watch time", formatWatchTime(analytics.data?.averageWatchMs ?? 0), Clock3],
    ["Followers", followers.data ?? 0, UsersRound],
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
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black">Creator Studio</h1>
          <p className="text-sm text-muted-foreground">Performance, content, and audience.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Post a video</span>
        </Button>
      </header>
      <nav className="mb-6 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["stats", "Analytics", BarChart3],
            ["videos", "Content", VideoIcon],
            ["earnings", "Earnings", WalletCards],
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
              title="Views"
              subtitle="Last 14 days"
              points={analytics.data?.daily ?? []}
              metric="views"
              color="#168bff"
            />
            <Chart
              title="Audience retention"
              subtitle="Average percentage watched"
              points={analytics.data?.daily ?? []}
              metric="retention"
              color="#8b5cf6"
              percent
            />
            <Chart
              title="Likes"
              subtitle="Last 14 days"
              points={analytics.data?.daily ?? []}
              metric="likes"
              color="#ec4899"
            />
            <Card className="p-5">
              <p className="font-black">Performance details</p>
              <div className="mt-5 space-y-4">
                <Progress
                  label="Completed views"
                  value={(analytics.data?.completionRate ?? 0) * 100}
                />
                <Progress label="Skipped early" value={(analytics.data?.skipRate ?? 0) * 100} />
                <p className="flex justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">Replays</span>
                  <b>{formatCount(analytics.data?.replays ?? 0)}</b>
                </p>
                <p className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Engagement</span>
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
              <p className="mt-3 font-bold">No videos yet</p>
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>
                Post your first video
              </Button>
            </Card>
          ) : (
            rows.map((video) => <VideoCard key={video.id} video={video} onDeleted={refresh} />)
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
              Coming soon
            </span>
            <h2 className="mt-4 text-3xl font-black">Creator earnings</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Estimated revenue, payouts, and creator rewards are being prepared.
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
        <span>14 days ago</span>
        <span>Today</span>
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
}: {
  video: {
    id: string;
    storage_path: string;
    caption: string | null;
    views_count: number;
    likes_count: number;
    visibility: string;
    boosted_until: string | null;
  };
  onDeleted: () => void;
}) {
  const url = useSignedUrl(video.storage_path);
  const [busy, setBusy] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const isBoosted = !!video.boosted_until && new Date(video.boosted_until).getTime() > Date.now();

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Video deleted");
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
          🚀 Boostée
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10 text-white">
        <p className="truncate text-xs font-bold">{video.caption || "Untitled"}</p>
        <p className="mt-1 text-[11px]">
          ◉ {formatCount(video.views_count)} · ♥ {formatCount(video.likes_count)}
        </p>
        <p className="mt-1 text-[10px] uppercase text-white/60">
          {video.visibility === "sparks" ? "My Sparks" : "Everyone"}
        </p>
        <button
          onClick={() => setBoosting(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-white/15 py-1.5 text-[11px] font-bold backdrop-blur"
        >
          🚀 {isBoosted ? "Prolonger le boost" : "Booster"}
        </button>
      </div>
      <button
        onClick={remove}
        disabled={busy}
        aria-label="Delete"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {boosting ? <BoostSheet videoId={video.id} onClose={() => setBoosting(false)} /> : null}
    </div>
  );
}

/** Spends Blox to extend videos.boosted_until - a real visibility-weighting
 * flag elsewhere in the feed/algorithm, never a fabricated like/view/follow
 * count. */
function BoostSheet({ videoId, onClose }: { videoId: string; onClose: () => void }) {
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
      toast.success(`Vidéo boostée pour ${hours}h !`);
      await qc.invalidateQueries({ queryKey: ["my-videos"] });
      await qc.invalidateQueries({ queryKey: ["blox-balance"] });
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("insufficient_balance")
          ? "Pas assez de Blox pour ce boost."
          : "Une erreur est survenue.",
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
        <p className="text-lg font-black">🚀 Booster ma vidéo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Le boost augmente la visibilité de ta vidéo dans le feed pendant la durée choisie. Il ne
          garantit pas de likes, vues ou abonnés.
        </p>
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
          Annuler
        </button>
      </div>
    </div>
  );
}

function UploadWizard({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const { user } = useSession();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
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
      toast.error("Maximum file size is 200 MB.");
      return;
    }
    setFile(selected);
  }
  function addTag() {
    const value = tag.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!value || hashtags.includes(value)) {
      setTag("");
      return;
    }
    if (hashtags.length >= 5) {
      toast.error("You can add up to 5 hashtags.");
      return;
    }
    setHashtags((current) => [...current, value]);
    setTag("");
  }
  async function publish() {
    if (!file || !user || !title.trim()) return;
    setBusy(true);
    try {
      const path = await uploadFile("videos", user.id, file, file.name.split(".").pop() || "mp4");
      const { data: inserted, error } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          storage_path: path,
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
      toast.success("Video published 🎉");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publishing failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="bx-pop flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[32px] border border-border bg-background sm:rounded-[32px]">
        <header className="flex items-center border-b border-border px-5 py-4">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="grid h-9 w-9 place-items-center"
            >
              <ArrowLeft />
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}
          <div className="flex-1 text-center">
            <b>Post a video</b>
            <p className="text-xs text-muted-foreground">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center">
            <X />
          </button>
        </header>
        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn("h-1.5 rounded-full", n <= step ? "bg-primary" : "bg-surface-2")}
            />
          ))}
        </div>
        <main className="overflow-y-auto px-5 py-6">
          {step === 1 ? (
            <section>
              <h2 className="text-2xl font-black">Choose your video</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a video file up to 200 MB.
              </p>
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
                    Change video
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => input.current?.click()}
                  className="mt-6 flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 py-16"
                >
                  <Upload className="h-9 w-9 text-primary" />
                  <b>Select a video file</b>
                </button>
              )}
            </section>
          ) : null}
          {step === 2 ? (
            <section>
              <h2 className="text-2xl font-black">Give it a title</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A clear title helps people find your video.
              </p>
              <Label className="mt-7">Video title</Label>
              <Input
                autoFocus
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is your video about?"
                className="h-14 text-base"
              />
              <p className="mt-2 text-right text-xs text-muted-foreground">{title.length}/120</p>
            </section>
          ) : null}
          {step === 3 ? (
            <section className="space-y-7">
              <div>
                <h2 className="text-2xl font-black">Hashtags and visibility</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add up to 5 hashtags and choose your audience.
                </p>
              </div>
              <div>
                <Label>Hashtags ({hashtags.length}/5)</Label>
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
                    Add
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
                <Label>Visibility</Label>
                <div className="mt-2 grid gap-3">
                  {(
                    [
                      ["public", "Everyone", "Visible across Discover", Globe2],
                      ["sparks", "My Sparks only", "Only people who follow you", UsersRound],
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
        <footer className="border-t border-border p-5">
          {step < 3 ? (
            <Button
              className="w-full"
              size="lg"
              disabled={(step === 1 && !file) || (step === 2 && !title.trim())}
              onClick={() => setStep((step + 1) as 2 | 3)}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="w-full" size="lg" disabled={busy} onClick={publish}>
              {busy ? "Publishing…" : "Publish video"}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

function formatWatchTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? seconds + "s" : Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
}
