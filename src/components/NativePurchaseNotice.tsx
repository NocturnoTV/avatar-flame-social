import { ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Shown instead of an embedded Stripe checkout inside the iOS/Android app -
 * see useNativeCheckoutGate() in src/lib/native.ts, which also fires the
 * actual redirect to the website. */
export function NativePurchaseNotice() {
  const { t } = useI18n();
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-surface p-6 text-center">
      <ExternalLink className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t("nativePurchaseRedirect")}</p>
    </div>
  );
}
