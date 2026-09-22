import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  ImagePlus,
  Lock,
  MessageSquareText,
  Music2,
  Pause,
  Play,
  Repeat2,
  Smile,
  Star,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { StoredImage, useSignedUrl, VideoThumb as SharedVideoThumb } from "@/components/Media";
import { PostCard } from "@/components/PostCard";
import type { PostAuthors, PostRow, PostVideos } from "@/lib/feedPosts";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type TabVideo = {
  id: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  views_count: number;
};
type TabPhoto = { id: string; url: string };
export type TabSticker = { id: string; storage_path: string };
export type TabSound = {
  id: string;
  storage_path: string;
  title: string;
  description: string | null;
  visibility: "public" | "private";
  usage_count: number;
};
type Tab = "videos" | "posts" | "reposts" | "photos" | "stickers" | "sounds" | "liked" | "favorites";
type LightboxTarget = { list: TabPhoto[]; index: number };

/**
 * The Videos / Reposts / Photos tab group shown on every profile - the
 * owner's own (/profile) and everyone else's (/users/$id) render this same
 * component, so both look identical apart from the edit affordances on the
 * Photos tab (only shown when `photosEditable` is set). Every item opens
 * full-screen on tap, with prev/next through the current tab's list.
 */
export function ProfileContentTabs({
  videos,
  feedPosts,
  feedAuthors,
  feedVideos,
  reposts,
  photos,
  stickers = [],
  sounds = [],
  likedVideos,
  favoriteVideos,
  photosEditable = false,
  stickersEditable = false,
  soundsEditable = false,
  maxPhotos,
  busy,
  onAddPhotoClick,
  onDeletePhoto,
  onMovePhoto,
  onAddStickerClick,
  onDeleteSticker,
  onAddSoundClick,
  onDeleteSound,
  onToggleSoundVisibility,
}: {
  videos: TabVideo[];
  /** Feed posts (BloxSpark's X-style feed) - optional since this component
   * is shared and callers that haven't wired the Feed query yet just omit
   * it, hiding the tab entirely rather than showing an always-empty one. */
  feedPosts?: PostRow[];
  feedAuthors?: PostAuthors;
  feedVideos?: PostVideos;
  reposts: TabVideo[];
  photos: TabPhoto[];
  stickers?: TabSticker[];
  sounds?: TabSound[];
  /** Only ever passed by the profile owner's own page - liked/favorited
   * videos are nobody else's business but yours. */
  likedVideos?: TabVideo[];
  favoriteVideos?: TabVideo[];
  photosEditable?: boolean;
  stickersEditable?: boolean;
  soundsEditable?: boolean;
  maxPhotos?: number;
  busy?: boolean;
  onAddPhotoClick?: () => void;
  onDeletePhoto?: (id: string) => void;
  onMovePhoto?: (index: number, delta: number) => void;
  onAddStickerClick?: () => void;
  onDeleteSticker?: (id: string) => void;
  onAddSoundClick?: () => void;
  onDeleteSound?: (id: string) => void;
  onToggleSoundVisibility?: (id: string, visibility: "public" | "private") => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("videos");
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null);

  const tabs: { id: Tab; label: string; icon: typeof Video; count: number }[] = [
    { id: "videos", label: t("videosTab"), icon: Video, count: videos.length },
    ...(feedPosts
      ? [{ id: "posts" as const, label: t("feedProfileTab"), icon: MessageSquareText, count: feedPosts.length }]
      : []),
    { id: "reposts", label: t("repostsTab"), icon: Repeat2, count: reposts.length },
    { id: "photos", label: t("photosTab"), icon: ImagePlus, count: photos.length },
    { id: "stickers", label: t("stickersTab"), icon: Smile, count: stickers.length },
    { id: "sounds", label: t("soundsTab"), icon: Music2, count: sounds.length },
    ...(likedVideos
      ? [{ id: "liked" as const, label: t("likedTab"), icon: Heart, count: likedVideos.length }]
      : []),
    ...(favoriteVideos
      ? [
          {
            id: "favorites" as const,
            label: t("favoritesTab"),
            icon: Star,
            count: favoriteVideos.length,
          },
        ]
      : []),
  ];

  return (
    <section className="mt-7">
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            aria-label={tb.label}
            title={tb.label}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center rounded-xl py-2.5 transition",
              tab === tb.id
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tb.icon className="h-4.5 w-4.5 shrink-0" />
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "videos" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {videos.map((v) => (
              <Link key={v.id} to="/discover" search={{ v: v.id }}>
                <VideoThumb video={v} />
              </Link>
            ))}
            {!videos.length ? <EmptyState label={t("noProfileVideos")} /> : null}
          </div>
        ) : null}

        {tab === "posts" ? (
          <div className="-mx-4">
            {(feedPosts ?? []).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                author={feedAuthors?.[post.user_id]}
                video={feedVideos?.[post.id]}
                onOpenThread={() => void navigate({ to: "/feed/$id", params: { id: post.id } })}
                onReply={() => void navigate({ to: "/feed/$id", params: { id: post.id } })}
                onRepostMenu={() => void navigate({ to: "/feed/$id", params: { id: post.id } })}
              />
            ))}
            {!feedPosts?.length ? <EmptyState label={t("feedNoPosts")} /> : null}
          </div>
        ) : null}

        {tab === "reposts" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {reposts.map((v) => (
              <Link key={v.id} to="/discover" search={{ v: v.id }}>
                <VideoThumb video={v} />
              </Link>
            ))}
            {!reposts.length ? <EmptyState label={t("noReposts")} /> : null}
          </div>
        ) : null}

        {tab === "photos" ? (
          <div className="flex flex-wrap gap-2">
            {photos.map((ph, i) => (
              <div key={ph.id} className="relative">
                <button onClick={() => setLightbox({ list: photos, index: i })}>
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

        {tab === "stickers" ? (
          <div className="flex flex-wrap gap-2">
            {stickers.map((s) => (
              <div key={s.id} className="relative">
                <StickerThumb path={s.storage_path} />
                {stickersEditable ? (
                  <button
                    onClick={() => onDeleteSticker?.(s.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
            {stickersEditable ? (
              <button
                onClick={onAddStickerClick}
                disabled={busy}
                className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Smile className="h-6 w-6" />
              </button>
            ) : null}
            {!stickers.length && !stickersEditable ? (
              <EmptyState label={t("noStickers")} />
            ) : null}
          </div>
        ) : null}

        {tab === "sounds" ? (
          <div className="space-y-2">
            {sounds.map((s) => (
              <SoundRow
                key={s.id}
                sound={s}
                editable={soundsEditable}
                onDelete={() => onDeleteSound?.(s.id)}
                onToggleVisibility={() =>
                  onToggleSoundVisibility?.(s.id, s.visibility === "public" ? "private" : "public")
                }
              />
            ))}
            {soundsEditable ? (
              <button
                onClick={onAddSoundClick}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Music2 className="h-4 w-4" /> {t("addSound")}
              </button>
            ) : null}
            {!sounds.length && !soundsEditable ? <EmptyState label={t("noSounds")} /> : null}
          </div>
        ) : null}

        {tab === "liked" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {(likedVideos ?? []).map((v) => (
              <Link key={v.id} to="/discover" search={{ v: v.id }}>
                <VideoThumb video={v} />
              </Link>
            ))}
            {!likedVideos?.length ? <EmptyState label={t("noLikedVideos")} /> : null}
          </div>
        ) : null}

        {tab === "favorites" ? (
          <div className="grid grid-cols-3 gap-1.5">
            {(favoriteVideos ?? []).map((v) => (
              <Link key={v.id} to="/discover" search={{ v: v.id }}>
                <VideoThumb video={v} />
              </Link>
            ))}
            {!favoriteVideos?.length ? <EmptyState label={t("noFavoriteVideos")} /> : null}
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

function SoundRow({
  sound,
  editable,
  onDelete,
  onToggleVisibility,
}: {
  sound: TabSound;
  editable: boolean;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const { t } = useI18n();
  const url = useSignedUrl(sound.storage_path);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <button
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? t("pause") : t("play")}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
      >
        {playing ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5" />}
      </button>
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{sound.title}</p>
        {sound.description ? (
          <p className="truncate text-xs text-muted-foreground">{sound.description}</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {t("soundUsageCount", { count: sound.usage_count })}
        </p>
      </div>
      {editable ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onToggleVisibility}
            className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
          >
            {sound.visibility === "private" ? (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" /> {t("soundPrivate")}
              </span>
            ) : (
              t("soundPublic")
            )}
          </button>
          <button
            onClick={onDelete}
            aria-label={t("delete")}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StickerThumb({ path }: { path: string }) {
  const url = useSignedUrl(path);
  return (
    <div className="grid h-24 w-24 place-items-center rounded-2xl bg-surface-2 p-2">
      {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : null}
    </div>
  );
}

function VideoThumb({ video }: { video: TabVideo }) {
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
      <SharedVideoThumb
        storagePath={video.storage_path}
        thumbnailPath={video.thumbnail_path}
        className="h-full w-full"
      />
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
    onChange({ ...target, index: next });
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
        <LightboxPhoto photo={target.list[target.index]!} />
      </div>
    </div>
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
