import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * BloxSpark wordmark — "BL◇XSPARK", the O stylized as a tilted diamond.
 * Rendered as inline SVG (not a raster asset) so it scales crisply at any
 * of the many h-* sizes used across the app and recolors via `currentColor`
 * exactly like the rest of the UI (no invert-filter hacks needed).
 */
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
    <svg
      viewBox="0 0 300 62"
      className={cn("w-auto select-none", className)}
      style={{ color: variant === "light" ? "#0b0b14" : "#ffffff" }}
      role="img"
      aria-label="BloxSpark"
    >
      <text
        x="0"
        y="46"
        fill="currentColor"
        fontFamily="var(--font-display), ui-sans-serif, sans-serif"
        fontWeight={700}
        fontSize={50}
        letterSpacing={-1.5}
        textLength={68}
        lengthAdjust="spacingAndGlyphs"
      >
        BL
      </text>
      <path
        d="M22 0 L44 22 L22 44 L0 22 Z M22 11 L33 22 L22 33 L11 22 Z"
        fill="currentColor"
        fillRule="evenodd"
        transform="translate(76 9) rotate(12 22 22)"
      />
      <text
        x="128"
        y="46"
        fill="currentColor"
        fontFamily="var(--font-display), ui-sans-serif, sans-serif"
        fontWeight={700}
        fontSize={50}
        letterSpacing={-1.5}
        textLength={172}
        lengthAdjust="spacingAndGlyphs"
      >
        XSPARK
      </text>
    </svg>
  );
}
