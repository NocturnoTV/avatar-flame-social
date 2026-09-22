import MuxPlayer from "@mux/mux-player-react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PostVideo } from "@/lib/feedPosts";

/** Renders a Feed post's attached Mux video - a processing/failed state
 * placeholder while Mux is still transcoding, or the actual player once
 * ready. `compact` drops the player's own controls for feed-list autoplay
 * (muted, looping, like a normal short-form video tile). */
export function PostVideoPlayer({
  video,
  compact,
  className,
}: {
  video: PostVideo;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();

  if (video.status === "failed") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 py-10 text-center text-muted-foreground",
          className,
        )}
      >
        <TriangleAlert className="h-5 w-5" />
        <p className="text-xs font-semibold">{t("postVideoFailed")}</p>
      </div>
    );
  }

  if (video.status !== "ready" || !video.mux_playback_id) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 py-10 text-center text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-xs font-semibold">{t("postVideoProcessing")}</p>
      </div>
    );
  }

  return (
    <MuxPlayer
      playbackId={video.mux_playback_id}
      streamType="on-demand"
      className={cn("overflow-hidden rounded-2xl", className)}
      {...(video.aspect_ratio
        ? { style: { aspectRatio: video.aspect_ratio.replace(":", "/") } }
        : {})}
      autoPlay={compact ? "muted" : false}
      loop={!!compact}
      muted={!!compact}
      playsInline
      nohotkeys={!!compact}
      metadata={{ video_id: video.id }}
    />
  );
}
