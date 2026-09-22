import { Link } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { Sheet, Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";

/** The prompt shown when a guest tries to do anything that writes (like,
 * comment, follow, post, join, send...) - paired with useGuestGate(). */
export function GuestGateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} center>
      <div className="flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <UserPlus className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold">{t("guestGateTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("guestActionLocked")}</p>
        <Link to="/auth" search={{ mode: "signup" }} className="mt-6 block w-full">
          <Button className="w-full" size="lg">
            {t("createAccount")}
          </Button>
        </Link>
        <button className="mt-3 text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
          {t("continueBrowsing")}
        </button>
      </div>
    </Sheet>
  );
}
