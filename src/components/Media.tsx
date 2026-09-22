import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    signedUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

export function StoredImage({
  path,
  className,
  alt,
  fallback,
}: {
  path: string | null | undefined;
  className?: string;
  alt: string;
  fallback?: string;
}) {
  const url = useSignedUrl(path);
  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-surface-2 text-2xl text-muted-foreground",
          className,
        )}
      >
        {fallback ?? "🎮"}
      </div>
    );
  }
  return <img src={url} alt={alt} className={cn("object-cover", className)} />;
}

/**
 * Video tile preview. Uses the stored thumbnail when there is one, otherwise
 * paints the frame at `seek` seconds (2s by default) from the video itself -
 * mobile WebViews never paint frame 0 on their own, so the tile would stay
 * black without an explicit seek.
 */
export function VideoThumb({
  storagePath,
  thumbnailPath,
  muxPlaybackId,
  className,
  seek = 2,
}: {
  storagePath: string | null | undefined;
  thumbnailPath?: string | null;
  /** Mux-hosted video (see the videos.mux_* columns) - its own thumbnail
   * endpoint is public and reliable, so it's preferred over everything
   * else when present. */
  muxPlaybackId?: string | null | undefined;
  className?: string;
  seek?: number;
}) {
  const thumbUrl = useSignedUrl(muxPlaybackId ? null : (thumbnailPath ?? null));
  const videoUrl = useSignedUrl(muxPlaybackId || thumbnailPath ? null : storagePath);
  if (muxPlaybackId) {
    return (
      <img
        src={`https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=480`}
        alt=""
        className={cn("object-cover", className)}
      />
    );
  }
  if (thumbUrl) return <img src={thumbUrl} alt="" className={cn("object-cover", className)} />;
  if (videoUrl)
    return (
      <video
        src={videoUrl}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          const duration = Number.isFinite(el.duration) ? el.duration : 0;
          el.currentTime = duration > seek ? seek : Math.max(duration - 0.05, 0.1);
        }}
        className={cn("object-cover", className)}
      />
    );
  return <div className={cn("animate-pulse bg-surface-2", className)} />;
}

export function StoredAudio({ path }: { path: string | null | undefined }) {
  const url = useSignedUrl(path);
  if (!url) return <span className="text-xs text-muted-foreground">…</span>;
  return <audio controls src={url} className="h-10 w-56 max-w-full" />;
}
