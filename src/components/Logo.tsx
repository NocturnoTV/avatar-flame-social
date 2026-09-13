import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  forceVariant,
}: {
  className?: string;
  forceVariant?: "dark" | "light";
}) {
  const { theme } = useTheme();
  const variant = forceVariant ?? theme;
  return (
    <img
      src="/bloxspark-logo.png"
      alt="Bloxspark"
      className={cn(
        "h-12 w-auto select-none object-contain",
        variant === "light" && "invert",
        className,
      )}
      draggable={false}
    />
  );
}
