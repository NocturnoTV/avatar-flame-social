import premiumDiamond from "@/assets/premium-diamond.png.asset.json";
import { cn } from "@/lib/utils";

export function PremiumIcon({ className }: { className?: string }) {
  return (
    <img
      src={premiumDiamond.url}
      alt=""
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}