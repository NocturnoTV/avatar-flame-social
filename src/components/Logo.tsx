import logoWhite from "@/assets/logo-white.png.asset.json";
import logoBlack from "@/assets/logo-black.png.asset.json";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      src={theme === "dark" ? logoWhite.url : logoBlack.url}
      alt="Bloxspark"
      className={cn("h-12 w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}
