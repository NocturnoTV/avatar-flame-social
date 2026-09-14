import { useState } from "react";
import { Link2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";

/** A profile's external link - always gated behind a leaving-BloxSpark warning. */
export function ExternalLinkButton({ url }: { url: string }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep the raw string if it doesn't parse as a URL */
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary"
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{host}</span>
      </button>

      {confirming ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/15 text-amber-500">
              <TriangleAlert className="h-6 w-6" />
            </span>
            <h2 className="mt-3 text-base font-bold">{t("leavingBloxsparkTitle")}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("leavingBloxsparkBody")}</p>
            <p className="mt-2 truncate rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
              {url}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  window.open(url, "_blank", "noopener,noreferrer");
                  setConfirming(false);
                }}
              >
                {t("continueAnyway")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
