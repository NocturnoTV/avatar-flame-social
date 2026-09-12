import { cn } from "@/lib/utils";

// Replace this single path with the supplied icon asset when it is available.
export const BRAND_ICON_SRC = "/favicon.png";

export function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_ICON_SRC}
      alt="BloxSpark"
      className={cn("h-9 w-9 select-none rounded-xl object-cover", className)}
      draggable={false}
    />
  );
}
