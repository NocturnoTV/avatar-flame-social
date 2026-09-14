import { StoredImage, useSignedUrl } from "@/components/Media";
import { BANNERS } from "@/lib/decorations";

/** Extracts a YouTube video ID from most common URL shapes, or null. */
export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] ?? null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Renders a profile banner: an animated banner (Spark Plus perk — an
 * uploaded video or a YouTube link) takes priority, then a static image,
 * then the classic gradient fallback.
 */
export function ProfileBanner({
  bannerVideoUrl,
  bannerUrl,
  bannerStyle,
  className,
}: {
  bannerVideoUrl?: string | null | undefined;
  bannerUrl?: string | null | undefined;
  bannerStyle?: string | null | undefined;
  className?: string | undefined;
}) {
  const youtubeId = bannerVideoUrl ? parseYouTubeId(bannerVideoUrl) : null;
  const isUploadedVideo = !!bannerVideoUrl && !youtubeId;
  const videoSignedUrl = useSignedUrl(isUploadedVideo ? bannerVideoUrl : null);

  if (youtubeId) {
    return (
      <div className={className}>
        <iframe
          className="pointer-events-none h-full w-full scale-[1.6] object-cover"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&controls=0&playlist=${youtubeId}&modestbranding=1&playsinline=1`}
          title="Banner"
          allow="autoplay; encrypted-media"
        />
      </div>
    );
  }

  if (isUploadedVideo && videoSignedUrl) {
    return (
      <video
        src={videoSignedUrl}
        className={className}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  if (bannerUrl) {
    return <StoredImage path={bannerUrl} alt="" className={className ?? ""} />;
  }

  return (
    <div
      className={className}
      style={{ backgroundImage: BANNERS[bannerStyle ?? "nebula"] ?? BANNERS["nebula"] }}
    />
  );
}
