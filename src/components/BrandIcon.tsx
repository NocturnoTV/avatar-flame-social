import { cn } from "@/lib/utils";

export const BRAND_ICON_SRC = "/bloxspark-logo.png";

export function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_ICON_SRC}
      alt="BloxSpark"
      className={cn("h-9 w-9 select-none object-contain invert dark:invert-0", className)}
      draggable={false}
    />
  );
}
