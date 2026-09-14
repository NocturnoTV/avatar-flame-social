import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Lock, ShoppingBag, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { errorMessage, cn } from "@/lib/utils";
import {
  BloxIcon,
  BloxBalanceChip,
  useBloxBalance,
  useInvalidateBloxBalance,
} from "@/components/Blox";
import { BloxPackCheckout } from "@/components/BloxPackCheckout";
import { BLOX_PROMO_PACK } from "@/lib/bloxPacks";
import { BADGE_RARITY_STYLES, BADGE_RARITY_LABEL_KEYS } from "@/lib/dailyQuests";

export const Route = createFileRoute("/_authenticated/store")({
  head: () => ({
    meta: [
      { title: "Blox Store - Bloxspark" },
      {
        name: "description",
        content: "Achète des badges à afficher sur ton profil avec tes Blox.",
      },
    ],
  }),
  component: BloxStorePage,
});

type Badge = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  price_blox: number;
  rarity: string;
};

function BloxStorePage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const balance = useBloxBalance();
  const invalidateBalance = useInvalidateBloxBalance();
  const [promoOpen, setPromoOpen] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const badges = useQuery({
    queryKey: ["blox-store-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("badges")
        .select("id,key,name,emoji,price_blox,rarity")
        .eq("active", true)
        .order("position");
      return (data ?? []) as Badge[];
    },
  });

  const owned = useQuery({
    queryKey: ["my-badges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("badge_id,equipped")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const ownedById = new Map((owned.data ?? []).map((b) => [b.badge_id, b.equipped]));

  async function buy(badge: Badge) {
    if (!user || buying) return;
    setBuying(badge.id);
    try {
      const { error } = await supabase.rpc("purchase_badge", { _badge: badge.id });
      if (error) throw error;
      toast.success(t("badgePurchased", { name: badge.name }));
      invalidateBalance();
      await owned.refetch();
    } catch (err) {
      const message = errorMessage(err, t("errorGeneric"));
      toast.error(message.includes("insufficient_balance") ? t("notEnoughBlox") : message);
    } finally {
      setBuying(null);
    }
  }

  async function toggleEquip(badgeId: string, equipped: boolean) {
    await supabase.rpc("toggle_badge_equipped", { _badge: badgeId, _equipped: !equipped });
    await owned.refetch();
    await qc.invalidateQueries({ queryKey: ["profile-badges"] });
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/shop" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl font-black">{t("bloxStore")}</h1>
        {user ? <BloxBalanceChip /> : null}
      </header>
      <p className="mt-2 text-sm text-muted-foreground">{t("bloxStoreText")}</p>

      {promoOpen ? (
        <div className="mt-5">
          <BloxPackCheckout
            lookupKey={BLOX_PROMO_PACK.lookupKey}
            onClose={() => setPromoOpen(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setPromoOpen(true)}
          className="mt-5 flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#3b0764_0%,#7c3aed_55%,#a855f7_100%)] p-5 text-left text-white shadow-xl shadow-primary/20 transition hover:-translate-y-0.5"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl">
            🔥
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-white/80">
              <Sparkles className="h-3.5 w-3.5" /> {t("mostPopular")}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-lg font-black">
              <BloxIcon className="h-4 w-4" /> {BLOX_PROMO_PACK.blox.toLocaleString()}
            </span>
            <span className="mt-0.5 block text-xs font-bold text-emerald-300">
              +{BLOX_PROMO_PACK.bonusPercent}% bonus
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-xl font-black">
              {BLOX_PROMO_PACK.priceEur.toLocaleString(lang, { minimumFractionDigits: 2 })} €
            </span>
            <span className="block text-xs text-white/60 line-through">
              {BLOX_PROMO_PACK.compareAtEur.toLocaleString(lang, { minimumFractionDigits: 2 })} €
            </span>
          </span>
        </button>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-black">{t("badges")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("badgesText")}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(badges.data ?? []).map((badge) => {
            const equipped = ownedById.get(badge.id);
            const isOwned = ownedById.has(badge.id);
            const canAfford = (balance.data ?? 0) >= badge.price_blox;
            return (
              <div
                key={badge.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-3xl border p-4 text-center",
                  BADGE_RARITY_STYLES[badge.rarity] ?? "border-border bg-card",
                )}
              >
                <span className="text-4xl">{badge.emoji}</span>
                <span className="text-sm font-black">{badge.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t(BADGE_RARITY_LABEL_KEYS[badge.rarity] ?? "rarityCommon")}
                </span>

                {isOwned ? (
                  <button
                    onClick={() => void toggleEquip(badge.id, !!equipped)}
                    className={cn(
                      "mt-1 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
                      equipped
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground",
                    )}
                  >
                    {equipped ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> {t("equipped")}
                      </>
                    ) : (
                      t("equip")
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => void buy(badge)}
                    disabled={!user || buying === badge.id || !canAfford}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    {buying === badge.id ? (
                      "…"
                    ) : !canAfford ? (
                      <>
                        <Lock className="h-3 w-3" /> {badge.price_blox.toLocaleString()}
                      </>
                    ) : (
                      <>
                        <BloxIcon className="h-3.5 w-3.5" /> {badge.price_blox.toLocaleString()}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Link
        to="/shop"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-black hover:border-primary/40"
      >
        <ShoppingBag className="h-4 w-4" /> {t("getMoreBlox")}
      </Link>
    </main>
  );
}
