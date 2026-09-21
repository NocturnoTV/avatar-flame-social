import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, History, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { StoredImage, VideoThumb } from "@/components/Media";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/recent")({
  head: () => ({ meta: [{ title: "Récents - Bloxspark" }] }),
  component: RecentPage,
});

const RANGE_FILTERS = [
  { id: "all", label: "toutLeTemps" },
  { id: "today", label: "aujourdhui" },
  { id: "week", label: "cetteSemaine" },
  { id: "month", label: "ceMois" },
] as const;

function rangeSince(id: (typeof RANGE_FILTERS)[number]["id"]) {
  if (id === "today") return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  if (id === "week") return new Date(Date.now() - 7 * 86_400_000).toISOString();
  if (id === "month") return new Date(Date.now() - 30 * 86_400_000).toISOString();
  return null;
}

function RecentPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<(typeof RANGE_FILTERS)[number]["id"]>("all");

  const profile = useQuery({
    queryKey: ["recent-profile-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("watch_history_enabled")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const enabled = !!profile.data?.watch_history_enabled;

  const history = useQuery({
    queryKey: ["watch-history", user?.id, range],
    enabled: !!user && enabled,
    queryFn: async () => {
      let query = supabase
        .from("watch_history")
        .select("video_id,watched_at")
        .eq("user_id", user!.id)
        .order("watched_at", { ascending: false })
        .limit(200);
      const since = rangeSince(range);
      if (since) query = query.gte("watched_at", since);
      const { data: rows } = await query;
      const ids = (rows ?? []).map((r) => r.video_id);
      if (!ids.length) return [];
      const { data: videos } = await supabase
        .from("videos")
        .select("id,storage_path,thumbnail_path,caption,user_id,views_count")
        .in("id", ids);
      const creatorIds = [...new Set((videos ?? []).map((v) => v.user_id))];
      const { data: creators } = creatorIds.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", creatorIds)
        : { data: [] };
      const creatorById = new Map((creators ?? []).map((c) => [c.id, c]));
      const videoById = new Map((videos ?? []).map((v) => [v.id, v]));
      return (rows ?? [])
        .map((r) => {
          const video = videoById.get(r.video_id);
          if (!video) return null;
          return { ...video, watched_at: r.watched_at, creator: creatorById.get(video.user_id) };
        })
        .filter((v): v is NonNullable<typeof v> => !!v);
    },
  });

  async function enableHistory() {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ watch_history_enabled: true })
      .eq("id", user.id);
    if (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["recent-profile-settings", user.id] });
  }

  const filtered = (history.data ?? []).filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (v.caption ?? "").toLowerCase().includes(q) ||
      (v.creator?.username ?? "").toLowerCase().includes(q)
    );
  });

  if (!user) return null;

  if (!enabled) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <header className="flex items-center gap-3">
          <Link to="/home" aria-label={t("back")}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-black">{t("menuRecent")}</h1>
        </header>
        <div className="mt-14 flex flex-col items-center text-center">
          <History className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold">{t("watchHistoryOffTitle")}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {t("watchHistoryOffText")}
          </p>
          <Button className="mt-5" onClick={() => void enableHistory()}>
            {t("enableWatchHistory")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black">{t("menuRecent")}</h1>
      </header>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchWatchHistory")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {RANGE_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setRange(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              range === f.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground",
            )}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {!history.isLoading && filtered.length === 0 ? (
        <p className="mt-14 text-center text-sm text-muted-foreground">{t("noWatchHistory")}</p>
      ) : null}

      <div className="mt-4 space-y-2">
        {filtered.map((v) => (
          <RecentRow key={`${v.id}-${v.watched_at}`} video={v} lang={lang} />
        ))}
      </div>
    </div>
  );
}

function RecentRow({
  video,
  lang,
}: {
  video: {
    id: string;
    storage_path: string;
    thumbnail_path: string | null;
    caption: string | null;
    watched_at: string;
    views_count: number;
    creator?: { username: string | null; avatar_url: string | null } | undefined;
  };
  lang: string;
}) {
  return (
    <Link
      to="/discover"
      search={{ v: video.id }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 transition hover:border-primary/30"
    >
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-black">
        <VideoThumb
          storagePath={video.storage_path}
          thumbnailPath={video.thumbnail_path}
          className="h-full w-full"
        />
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-center gap-1.5">
          <StoredImage
            path={video.creator?.avatar_url}
            alt=""
            className="h-4 w-4 rounded-full object-cover"
            fallback="🎮"
          />
          <span className="truncate text-xs font-semibold text-muted-foreground">
            {video.creator?.username ?? "?"}
          </span>
        </div>
        {video.caption ? <p className="mt-1 truncate text-sm font-bold">{video.caption}</p> : null}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(video.watched_at).toLocaleString(lang, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </Link>
  );
}
