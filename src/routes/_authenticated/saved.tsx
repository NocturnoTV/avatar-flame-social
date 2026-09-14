import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSignedUrl } from "@/components/Media";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Enregistrés - Bloxspark" }] }),
  component: SavedVideosPage,
});

type SavedVideo = { id: string; storage_path: string; caption: string | null; views_count: number };

function SavedVideosPage() {
  const { t } = useI18n();
  const { user } = useSession();

  const videos = useQuery({
    queryKey: ["saved-videos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("video_favorites")
        .select("video_id,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.video_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("videos")
        .select("id,storage_path,caption,views_count")
        .in("id", ids);
      const byId = new Map((data ?? []).map((v) => [v.id, v as SavedVideo]));
      return ids.map((id) => byId.get(id)).filter((v): v is SavedVideo => !!v);
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black">{t("menuSaved")}</h1>
      </header>

      {!videos.isLoading && !(videos.data ?? []).length ? (
        <div className="mt-14 flex flex-col items-center text-center">
          <Bookmark className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold">{t("noSavedVideos")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("noSavedVideosText")}</p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {(videos.data ?? []).map((v) => (
          <Link
            key={v.id}
            to="/discover"
            search={{ v: v.id }}
            className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-black transition hover:-translate-y-0.5"
          >
            <SavedVideoThumb path={v.storage_path} views={v.views_count} caption={v.caption} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function SavedVideoThumb({
  path,
  views,
  caption,
}: {
  path: string;
  views: number;
  caption: string | null;
}) {
  const url = useSignedUrl(path);
  return (
    <>
      {url ? (
        <video
          src={url}
          muted
          playsInline
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-surface-2" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 text-white">
        <p className="flex items-center gap-1 text-[10px] font-bold">
          <Play className="h-3 w-3 fill-white" /> {views}
        </p>
        {caption ? <p className="truncate text-[9px] text-white/75">{caption}</p> : null}
      </div>
    </>
  );
}
