import { useState } from "react";
import { toast } from "sonner";
import { Crown, Gift } from "lucide-react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { errorMessage, cn } from "@/lib/utils";
import { Sheet, Button } from "@/components/ui-kit";
import { BloxIcon, useBloxBalance, useInvalidateBloxBalance } from "@/components/Blox";
import { BloxPackCheckout } from "@/components/BloxPackCheckout";
import { BLOX_PACKS } from "@/lib/bloxPacks";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSparkPlusGiftCheckout } from "@/utils/payments.functions";

const QUICK_AMOUNTS = [100, 500, 1000, 2500];

function SparkPlusGiftCheckout({
  recipientId,
  onClose,
}: {
  recipientId: string;
  onClose: () => void;
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createSparkPlusGiftCheckout({
      data: {
        recipientId,
        returnUrl: `${window.location.origin}/messages`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-white p-2">
      <button
        onClick={onClose}
        className="ml-1 mt-1 text-xs font-bold text-neutral-500 hover:text-neutral-800"
      >
        ← Retour
      </button>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

/**
 * "Cadeau" for one specific person, already known (a comment's author, the
 * other side of a DM): send Blox you already own, buy a fresh pack credited
 * straight to them, or gift a month of Spark Plus. Used from the
 * conversation "..." menu and from video comments.
 */
export function GiftSheet({
  targetUserId,
  targetUsername,
  videoId,
  onGiftSent,
  onClose,
}: {
  targetUserId: string;
  targetUsername: string;
  videoId?: string;
  onGiftSent?: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const balance = useBloxBalance();
  const invalidateBalance = useInvalidateBloxBalance();
  const [tab, setTab] = useState<"blox" | "plus">("blox");
  const [amount, setAmount] = useState(100);
  const [sending, setSending] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [giftingPlus, setGiftingPlus] = useState(false);

  const canAfford = (balance.data ?? 0) >= amount;

  async function sendOwnedBlox() {
    if (!user || sending) return;
    setSending(true);
    try {
      const { error } = videoId
        ? await supabase.rpc("gift_video_creator", { _video: videoId, _amount: amount })
        : await supabase.rpc("gift_blox", {
            _to_user: targetUserId,
            _amount: amount,
          });
      if (error) throw error;
      toast.success(t("bloxGiftSent", { amount: amount.toLocaleString() }));
      invalidateBalance();
      onGiftSent?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t("bloxGiftFailed")));
    } finally {
      setSending(false);
    }
  }

  if (buyingPack) {
    return (
      <Sheet open onClose={onClose} title={t("giftBlox")}>
        <BloxPackCheckout
          lookupKey={buyingPack}
          recipientId={targetUserId}
          onClose={() => setBuyingPack(null)}
        />
      </Sheet>
    );
  }

  if (giftingPlus) {
    return (
      <Sheet open onClose={onClose} title={t("giftSparkPlus")}>
        <SparkPlusGiftCheckout recipientId={targetUserId} onClose={() => setGiftingPlus(false)} />
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={t("giftTo", { username: targetUsername })}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
          <button
            onClick={() => setTab("blox")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition",
              tab === "blox" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <BloxIcon className="h-4 w-4" /> Blox
          </button>
          <button
            onClick={() => setTab("plus")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition",
              tab === "plus" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Crown className="h-4 w-4" /> Spark Plus
          </button>
        </div>

        {tab === "blox" ? (
          <div className="space-y-4">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {t("yourBalance")}: <BloxIcon className="h-4 w-4" />
              <span className="font-bold text-foreground">
                {(balance.data ?? 0).toLocaleString()}
              </span>
            </p>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                {t("amount")}
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-bold transition",
                      amount === a
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground",
                    )}
                  >
                    <BloxIcon className="h-3.5 w-3.5" /> {a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!canAfford || sending}
              onClick={() => void sendOwnedBlox()}
            >
              {sending ? "…" : t("sendGift")}
            </Button>
            {!canAfford ? (
              <div className="rounded-2xl border border-dashed border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("notEnoughBloxBuyForThem")}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {BLOX_PACKS.map((pack) => (
                    <button
                      key={pack.lookupKey}
                      onClick={() => setBuyingPack(pack.lookupKey)}
                      className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                    >
                      {pack.emoji} {pack.blox.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
            <Crown className="mx-auto h-8 w-8 text-primary" />
            <p className="font-black">{t("giftSparkPlusMonth")}</p>
            <p className="text-sm text-muted-foreground">{t("giftSparkPlusText")}</p>
            <Button className="w-full" onClick={() => setGiftingPlus(true)}>
              <Gift className="h-4 w-4" /> 4,99 €
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
