import { cn } from "@/lib/utils";

export const BRAND_ICON_SRC = "/bloxspark-icon.svg";

export function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_ICON_SRC}
      alt="BloxSpark"
      className={cn("h-9 w-9 select-none rounded-xl", className)}
      draggable={false}
    />
  );
}
