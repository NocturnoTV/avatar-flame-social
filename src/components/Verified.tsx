import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/** Coche bleue de certification Bloxspark. */
export function Verified({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={t("verifiedAccount")}
      className={cn("inline-block h-4 w-4 shrink-0", className)}
    >
      <title>{t("verifiedAccount")}</title>
      <rect
        x="4"
        y="4"
        width="24"
        height="24"
        rx="2"
        fill="#0066FF"
        transform="rotate(-12 16 16)"
      />
      <path
        d="M10.5 16.5l3.8 3.8 7.4-7.6"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
