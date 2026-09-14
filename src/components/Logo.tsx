import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** The square "B" mark - the default logo used across the app. */
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

/** Official BloxSpark wordmark, switched to match the active light or dark theme. */
export function LogoWordmark({
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
      src={variant === "light" ? "/bloxspark-wordmark-black.png" : "/bloxspark-wordmark-white.png"}
      alt="BloxSpark"
      className={cn("w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}
