import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Play,
  Repeat2,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export type TabVideo = {
  id: string;
  storage_path: string;
  caption: string | null;
  views_count: number;
};
type TabPhoto = { id: string; url: string };
type Tab = "videos" | "reposts" | "photos";
type LightboxTarget =
  | { kind: "video"; list: TabVideo[]; index: number }
  | { kind: "photo"; list: TabPhoto[]; index: number };

/**
 * The Videos / Reposts / Photos tab group shown on every profile — the
 * owner's own (/profile) and everyone else's (/users/$id) render this same
 * component, so both look identical apart from the edit affordances on the
 * Photos tab (only shown when `photosEditable` is set). Every item opens
 * full-screen on tap, with prev/next through the current tab's list.
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
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null);

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
            {videos.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setLightbox({ kind: "video", list: videos, index: i })}
              >
                <VideoThumb video={v} />
              </button>
            ))}
            {!videos.length ? <EmptyState label={t("noProfileVideos")} /> : null}
          </div>
        ) : null}

        {tab === "reposts" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {reposts.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setLightbox({ kind: "video", list: reposts, index: i })}
              >
                <VideoThumb video={v} />
              </button>
            ))}
            {!reposts.length ? <EmptyState label={t("noReposts")} /> : null}
          </div>
        ) : null}

        {tab === "photos" ? (
          <div className="flex flex-wrap gap-2">
            {photos.map((ph, i) => (
              <div key={ph.id} className="relative">
                <button onClick={() => setLightbox({ kind: "photo", list: photos, index: i })}>
                  <StoredImage path={ph.url} alt="" className="h-24 w-24 rounded-2xl" />
                </button>
                {i === 0 ? (
                  <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
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
                    <div className="pointer-events-none absolute inset-x-1 bottom-1 flex justify-between">
                      <button
                        onClick={() => onMovePhoto?.(i, -1)}
                        disabled={i === 0}
                        className="pointer-events-auto rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                        aria-label="Move left"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onMovePhoto?.(i, 1)}
                        disabled={i === photos.length - 1}
                        className="pointer-events-auto rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
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

      {lightbox ? (
        <Lightbox target={lightbox} onChange={setLightbox} onClose={() => setLightbox(null)} />
      ) : null}
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

/** Full-screen viewer for a tapped video or photo, with prev/next within its tab. */
function Lightbox({
  target,
  onChange,
  onClose,
}: {
  target: LightboxTarget;
  onChange: (t: LightboxTarget) => void;
  onClose: () => void;
}) {
  const { index, list } = target;
  const hasPrev = index > 0;
  const hasNext = index < list.length - 1;

  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    onChange({ ...target, index: next } as LightboxTarget);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>
      {hasPrev ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white sm:left-6"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}
      {hasNext ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white sm:right-6"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}
      <div
        className="relative h-full max-h-[850px] w-full max-w-md overflow-hidden rounded-3xl bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        {target.kind === "video" ? <LightboxVideo video={target.list[target.index]!} /> : null}
        {target.kind === "photo" ? <LightboxPhoto photo={target.list[target.index]!} /> : null}
      </div>
    </div>
  );
}

function LightboxVideo({ video }: { video: TabVideo }) {
  const url = useSignedUrl(video.storage_path);
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      void supabase
        .from("video_views")
        .upsert(
          { video_id: video.id, viewer_id: user.id },
          { onConflict: "video_id,viewer_id", ignoreDuplicates: true },
        );
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [user, video.id]);

  return (
    <>
      {url ? (
        <video
          src={url}
          autoPlay
          controls
          loop
          playsInline
          className="h-full w-full object-contain"
        />
      ) : null}
      {video.caption ? (
        <p className="pointer-events-none absolute inset-x-4 bottom-5 rounded-2xl bg-black/55 p-3 text-sm text-white backdrop-blur">
          {video.caption}
        </p>
      ) : null}
    </>
  );
}

function LightboxPhoto({ photo }: { photo: TabPhoto }) {
  const url = useSignedUrl(photo.url);
  return url ? (
    <img src={url} alt="" className="h-full w-full object-contain" />
  ) : (
    <div className="grid h-full w-full place-items-center text-white/50">…</div>
  );
}
