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

export function StoredAudio({ path }: { path: string | null | undefined }) {
  const url = useSignedUrl(path);
  if (!url) return <span className="text-xs text-muted-foreground">…</span>;
  return <audio controls src={url} className="h-10 w-56 max-w-full" />;
}
