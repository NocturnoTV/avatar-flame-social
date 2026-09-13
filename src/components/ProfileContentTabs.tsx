import { useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Play, Repeat2, Trash2, Video } from "lucide-react";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type TabVideo = {
  id: string;
  storage_path: string;
  caption: string | null;
  views_count: number;
};
type TabPhoto = { id: string; url: string };
type Tab = "videos" | "reposts" | "photos";

/**
 * The Videos / Reposts / Photos tab group shown on every profile — the
 * owner's own (/profile) and everyone else's (/users/$id) render this same
 * component, so both look identical apart from the edit affordances on the
 * Photos tab (only shown when `photosEditable` is set).
 */
export function ProfileContentTabs({
  videos,
  reposts,
  photos,
  photosEditable = false,
  maxPhotos,
  busy,
  onAddPhotoClick,
  onDeletePhoto,
  onMovePhoto,
}: {
  videos: TabVideo[];
  reposts: TabVideo[];
  photos: TabPhoto[];
  photosEditable?: boolean;
  maxPhotos?: number;
  busy?: boolean;
  onAddPhotoClick?: () => void;
  onDeletePhoto?: (id: string) => void;
  onMovePhoto?: (index: number, delta: number) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("videos");

  const tabs: { id: Tab; label: string; icon: typeof Video; count: number }[] = [
    { id: "videos", label: t("videosTab"), icon: Video, count: videos.length },
    { id: "reposts", label: t("repostsTab"), icon: Repeat2, count: reposts.length },
    { id: "photos", label: t("photosTab"), icon: ImagePlus, count: photos.length },
  ];

  return (
    <section className="mt-7">
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
              tab === tb.id
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tb.icon className="h-3.5 w-3.5" />
            {tb.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "videos" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {videos.map((v) => (
              <VideoThumb key={v.id} video={v} />
            ))}
            {!videos.length ? <EmptyState label={t("noProfileVideos")} /> : null}
          </div>
        ) : null}

        {tab === "reposts" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {reposts.map((v) => (
              <VideoThumb key={v.id} video={v} />
            ))}
            {!reposts.length ? <EmptyState label={t("noReposts")} /> : null}
          </div>
        ) : null}

        {tab === "photos" ? (
          <div className="flex flex-wrap gap-2">
            {photos.map((ph, i) => (
              <div key={ph.id} className="relative">
                <StoredImage path={ph.url} alt="" className="h-24 w-24 rounded-2xl" />
                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                    1
                  </span>
                ) : null}
                {photosEditable ? (
                  <>
                    <button
                      onClick={() => onDeletePhoto?.(ph.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute inset-x-1 bottom-1 flex justify-between">
                      <button
                        onClick={() => onMovePhoto?.(i, -1)}
                        disabled={i === 0}
                        className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                        aria-label="Move left"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onMovePhoto?.(i, 1)}
                        disabled={i === photos.length - 1}
                        className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                        aria-label="Move right"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ))}
            {photosEditable && (!maxPhotos || photos.length < maxPhotos) ? (
              <button
                onClick={onAddPhotoClick}
                disabled={busy}
                className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <ImagePlus className="h-6 w-6" />
              </button>
            ) : null}
            {!photos.length && !photosEditable ? <EmptyState label={t("noProfileVideos")} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="col-span-3 rounded-3xl bg-surface py-10 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

function VideoThumb({ video }: { video: TabVideo }) {
  const url = useSignedUrl(video.storage_path);
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
      {url ? <video src={url} muted playsInline className="h-full w-full object-cover" /> : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white">
        <p className="flex items-center gap-1 text-[11px] font-bold">
          <Play className="h-3 w-3 fill-white" />
          {video.views_count}
        </p>
        {video.caption ? (
          <p className="mt-0.5 truncate text-[10px] text-white/75">{video.caption}</p>
        ) : null}
      </div>
    </div>
  );
}
