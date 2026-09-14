import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { errorMessage, cn } from "@/lib/utils";
import { Sheet, Button } from "@/components/ui-kit";
import { StoredImage } from "@/components/Media";
import { BloxIcon, useBloxBalance, useInvalidateBloxBalance } from "@/components/Blox";

const QUICK_AMOUNTS = [100, 500, 1000, 2500];

/** Gift Blox to one of your Sparks (people you follow) - a plain internal
 * balance transfer via the gift_blox RPC, no Stripe involved. */
export function GiftBloxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useSession();
  const balance = useBloxBalance();
  const invalidateBalance = useInvalidateBloxBalance();
  const [target, setTarget] = useState<string | null>(null);
  const [amount, setAmount] = useState(100);
  const [sending, setSending] = useState(false);

  const friends = useQuery({
    queryKey: ["gift-blox-friends", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const ids = [...new Set((rows ?? []).map((r) => r.following_id))];
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids);
      return data ?? [];
    },
  });

  async function send() {
    if (!target || amount <= 0) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("gift_blox", { _to_user: target, _amount: amount });
      if (error) throw error;
      toast.success(t("bloxGiftSent", { amount: amount.toLocaleString() }));
      invalidateBalance();
      setTarget(null);
      setAmount(100);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t("bloxGiftFailed")));
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("giftBlox")}>
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {t("yourBalance")}: <BloxIcon className="h-4 w-4" />
          <span className="font-bold text-foreground">{(balance.data ?? 0).toLocaleString()}</span>
        </p>

        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            {t("chooseASpark")}
          </p>
          {!friends.data?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("noFriendsYet")}</p>
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {friends.data.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTarget(f.id)}
                  className={cn(
                    "flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1.5",
                    target === f.id ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-surface-2",
                  )}
                >
                  <StoredImage
                    path={f.avatar_url}
                    alt={f.username ?? ""}
                    className="h-12 w-12 rounded-full object-cover"
                    fallback="🎮"
                  />
                  <span className="w-full truncate text-center text-[11px] font-semibold">
                    {f.username ?? "player"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

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
          disabled={!target || sending || amount <= 0 || amount > (balance.data ?? 0)}
          onClick={() => void send()}
        >
          {sending ? "…" : t("sendGift")}
        </Button>
        {amount > (balance.data ?? 0) ? (
          <p className="text-center text-xs text-destructive">{t("notEnoughBlox")}</p>
        ) : null}
      </div>
    </Sheet>
  );
}
