import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
  Gift,
  Lock,
  Megaphone,
  Palette,
  Plus,
  Rocket,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { SparkPlusCheckout } from "@/components/SparkPlusCheckout";
import { BloxPackCheckout } from "@/components/BloxPackCheckout";
import { GiftBloxSheet } from "@/components/GiftBloxSheet";
import { BloxIcon, BloxBalanceChip } from "@/components/Blox";
import { BLOX_PACKS, type BloxPack } from "@/lib/bloxPacks";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Boutique - Bloxspark" },
      {
        name: "description",
        content: "Achète des Blox, débloque Spark Plus et personnalise ton profil sur Bloxspark.",
      },
    ],
  }),
  component: ShopPage,
});

const USES = [
  { emoji: "🚀", icon: Rocket, title: "Booster tes vidéos", text: "Plus de visibilité" },
  { emoji: "🏅", icon: Award, title: "Acheter des badges", text: "Affiche ton style" },
  { emoji: "🎨", icon: Palette, title: "Personnaliser ton profil", text: "Thèmes et effets" },
  { emoji: "🎁", icon: Gift, title: "Cadeaux virtuels", text: "Soutiens tes créateurs" },
  {
    emoji: "📣",
    icon: Megaphone,
    title: "Mettre en avant ton profil",
    text: "Sois vu par plus de monde",
  },
];

const QUEST_EXAMPLES = [
  { emoji: "❤️", title: "Social Spark", text: "Aime 10 publications", reward: 30 },
  { emoji: "💬", title: "Conversation", text: "Commente 3 publications", reward: 40 },
  { emoji: "🎥", title: "Creator", text: "Publie une vidéo", reward: 50 },
  { emoji: "👥", title: "Explorer", text: "Visite 10 profils", reward: 25 },
];

const PLUS_FEATURES = [
  "Badge Spark Plus exclusif",
  "Effets et thèmes premium",
  "Statistiques avancées",
  "Personnalisation complète",
  "Support prioritaire",
];

const TRUST_ITEMS = [
  { emoji: "⚡", title: "Blox instantanés", text: "Reçois tes Blox dès l'achat" },
  { emoji: "🔒", title: "Paiement sécurisé", text: "Transactions protégées" },
  { emoji: "💳", title: "Plusieurs moyens de paiement", text: "Carte, Apple Pay, Google Pay..." },
  { emoji: "🎧", title: "Besoin d'aide ?", text: "Notre équipe est là pour toi" },
];

type CheckoutStage = { kind: "pack"; pack: BloxPack } | { kind: "plus" } | null;

function ShopPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [confirming, setConfirming] = useState<CheckoutStage>(null);
  const [checkingOut, setCheckingOut] = useState<CheckoutStage>(null);

  const membership = useQuery({
    queryKey: ["spark-plus-membership", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spark_plus_active,spark_plus_expires_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  async function manageSubscription() {
    try {
      const result = await createPortalSession({
        data: { returnUrl: window.location.href, environment: getStripeEnvironment() },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch {
      toast.error(t("sparkPlusCheckoutUnavailable"));
    }
  }

  const faq = [
    { q: "Qu'est-ce que les Blox ?", a: t("shopFaqBloxA") },
    {
      q: "Comment puis-je obtenir des Blox ?",
      a: "Tu peux acheter des Blox ou en gagner gratuitement grâce aux défis, récompenses et événements Bloxspark.",
    },
    {
      q: "Les achats sont-ils sécurisés ?",
      a: "Les paiements sont traités par Stripe. Bloxspark ne stocke jamais tes informations de carte complètes.",
    },
    { q: "Les Blox sont-ils remboursables ?", a: t("shopFaqBloxRefundA") },
    {
      q: "Que puis-je acheter avec mes Blox ?",
      a: "Des boosts de vidéo, des badges, des éléments de personnalisation, des cadeaux virtuels et d'autres fonctionnalités de la boutique.",
    },
    { q: "Qu'est-ce que Spark Plus ?", a: t("sparkPlusHero") },
    {
      q: "Puis-je convertir mes Blox en argent ?",
      a: "Non. Les Blox sont une monnaie virtuelle destinée à être utilisée sur Bloxspark et ne constituent pas un solde monétaire.",
    },
    {
      q: "Est-ce que les Blox expirent ?",
      a: "Non, ton solde de Blox n'expire pas tant que ton compte reste actif.",
    },
    { q: t("shopFaqCancelQ"), a: t("shopFaqCancelA") },
    { q: t("shopFaqRenewQ"), a: t("shopFaqRenewA") },
  ];

  const expiration = membership.data?.spark_plus_expires_at;
  const isActive = Boolean(
    membership.data?.spark_plus_active &&
    (!expiration || new Date(expiration).getTime() > Date.now()),
  );

  const [row1, row2] = [BLOX_PACKS.slice(0, 3), BLOX_PACKS.slice(3)];

  return (
    <main className="mx-auto w-full max-w-2xl bg-[#080B18] px-5 pb-28 pt-5 text-white">
      <PaymentTestModeBanner />

      {/* 3. Header */}
      <header className="flex items-center justify-between">
        <Link
          to="/home"
          aria-label={t("back")}
          className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="text-lg font-black">
          Blox
          <span className="bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent">
            Spark
          </span>
        </p>
        {user ? (
          <a
            href="#packs"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#10152A] px-3 py-1.5 text-sm font-black"
          >
            <BloxBalanceChip className="border-0 bg-transparent px-0 py-0" />
            <Plus className="h-3.5 w-3.5 text-[#22D3EE]" />
          </a>
        ) : (
          <span className="w-10" />
        )}
      </header>

      {/* 4. Title */}
      <h1 className="mt-7 text-4xl font-black leading-tight">
        Acheter des{" "}
        <span className="bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] bg-clip-text text-transparent">
          Blox
        </span>
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#AEB5D0]">
        Choisis le pack qui te convient et obtiens des Blox instantanément. Utilise-les pour
        personnaliser ton profil, booster tes vidéos et bien plus encore !
      </p>

      {/* 5. Secure payment indicator */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#10152A] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#22D3EE]/15 text-[#22D3EE]">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">Paiement sécurisé</p>
          <p className="text-xs text-[#AEB5D0]">100% sécurisé, via Stripe</p>
        </div>
      </div>

      {/* 6. Promo banner */}
      <div className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,#0d1230_0%,#1c1440_55%,#2a1240_100%)] p-5">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#8B5CF6]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-[#EC4899]/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl">
            🎮
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black leading-snug">Plus de possibilités avec les Blox !</p>
            <p className="mt-1 text-xs text-[#AEB5D0]">
              Personnalise, crée, partage et fais grandir ta communauté sur Bloxspark.
            </p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8B5CF6]">
              Create · Share · Belong
            </p>
          </div>
        </div>
      </div>

      {/* 7-13. Packs */}
      <section id="packs" className="mt-8 scroll-mt-6">
        <h2 className="text-xl font-black">Acheter des Blox</h2>
        <p className="mt-1 text-sm text-[#AEB5D0]">
          Choisis le pack qui te convient et obtiens tes Blox instantanément.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {row1.map((pack) => (
            <PackCard
              key={pack.lookupKey}
              pack={pack}
              lang={lang}
              onBuy={() => setConfirming({ kind: "pack", pack })}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {row2.map((pack) => (
            <PackCard
              key={pack.lookupKey}
              pack={pack}
              lang={lang}
              large
              onBuy={() => setConfirming({ kind: "pack", pack })}
            />
          ))}
        </div>

        <button
          onClick={() => setGiftOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[#10152A] py-3 text-sm font-bold text-[#AEB5D0]"
        >
          <Gift className="h-4 w-4" /> {t("giftBlox")}
        </button>
      </section>

      {/* 14. What Blox are for */}
      <section className="mt-10">
        <h2 className="text-xl font-black">À quoi servent les Blox ?</h2>
        <p className="mt-1 text-sm text-[#AEB5D0]">
          Utilise tes Blox pour personnaliser ton expérience et soutenir la communauté.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {USES.map((use) => (
            <div
              key={use.title}
              className="rounded-2xl border border-white/10 bg-[#10152A]/80 p-3.5 backdrop-blur"
            >
              <span className="text-xl">{use.emoji}</span>
              <p className="mt-2 text-sm font-black leading-snug">{use.title}</p>
              <p className="mt-0.5 text-[11px] text-[#AEB5D0]">{use.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-[#AEB5D0]">
          🚀 Le boost de vidéo se lance depuis le Creator Studio, sur chacune de tes vidéos. Il
          augmente ta visibilité dans le feed - il ne génère jamais de faux likes, vues ou abonnés.
        </p>
      </section>

      {/* 16. Earn Blox free */}
      <Link
        to="/rewards"
        className="mt-8 flex items-center gap-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,#5b21b6_0%,#a21caf_60%,#db2777_100%)] p-5 shadow-lg shadow-[#a21caf]/20"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl">
          🎁
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black leading-snug">Gagne des Blox gratuitement !</p>
          <p className="mt-1 text-xs text-white/80">
            Complète des défis, participe à des événements et sois actif sur Bloxspark.
          </p>
        </div>
        <span className="shrink-0 text-sm font-black">Voir →</span>
      </Link>

      {/* 17. Quest examples */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {QUEST_EXAMPLES.map((q) => (
          <div key={q.title} className="rounded-2xl border border-white/10 bg-[#10152A]/80 p-3.5">
            <span className="text-xl">{q.emoji}</span>
            <p className="mt-1.5 text-sm font-black">{q.title}</p>
            <p className="text-[11px] text-[#AEB5D0]">{q.text}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-black text-[#22D3EE]">
              +{q.reward} <BloxIcon className="h-3.5 w-3.5" />
            </p>
          </div>
        ))}
      </div>

      {/* 18. Spark Plus */}
      <section className="mt-10">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#a855f7]/30 bg-[linear-gradient(160deg,#2e0a5c_0%,#5b1a8c_55%,#7c2d9e_100%)] p-6 shadow-[0_0_60px_-15px_rgba(168,85,247,.55)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur">
            🔥 Le plus populaire
          </span>
          <h2 className="mt-3 flex items-center gap-2 text-3xl font-black">
            <Sparkles className="h-6 w-6 text-[#f0abfc]" /> Spark Plus
          </h2>
          <p className="mt-1 text-sm text-white/80">Encore plus de possibilités.</p>
          <div className="mt-4 flex items-end gap-1.5">
            <span className="text-3xl font-black">4,99 €</span>
            <span className="pb-1 text-sm text-white/70">/{t("month")}</span>
          </div>

          <div className="mt-4 space-y-1.5">
            {PLUS_FEATURES.map((f) => (
              <p key={f} className="flex items-center gap-2 text-sm text-white/90">
                <Check className="h-4 w-4 shrink-0 text-emerald-300" /> {f}
              </p>
            ))}
          </div>

          {isActive ? (
            <div className="mt-5 rounded-2xl bg-white/15 p-4 backdrop-blur">
              <p className="flex items-center gap-2 font-black">
                <Check className="h-5 w-5" /> {t("sparkPlusActive")}
              </p>
              {expiration ? (
                <p className="mt-1 text-xs text-white/75">
                  {t("renewsOn", { date: new Date(expiration).toLocaleDateString(lang) })}
                </p>
              ) : null}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void manageSubscription()}
                  className="flex-1 rounded-full bg-white py-2.5 text-sm font-black text-[#7c3aed]"
                >
                  {t("manageSubscription")}
                </button>
                <Link
                  to="/shop/billing"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/40 py-2.5 text-sm font-bold text-white"
                >
                  {t("purchasesAndBilling")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirming({ kind: "plus" })}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-black text-[#7c3aed] shadow-lg"
              >
                Devenir Spark+ →
              </button>
              <p className="mt-2 text-center text-[11px] text-white/70">
                Annule à tout moment. Sans engagement.
              </p>
            </>
          )}
        </div>
      </section>

      {/* 19. Badges */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Badges</h2>
            <p className="mt-1 text-sm text-[#AEB5D0]">
              Montre qui tu es et collectionne les badges Bloxspark.
            </p>
          </div>
        </div>
        <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto pb-1">
          {[
            "🏅 Early Member",
            "🎮 Gamer",
            "🎬 Creator",
            "🏆 Veteran",
            "💎 Supporter",
            "👑 Elite",
          ].map((b) => (
            <span
              key={b}
              className="shrink-0 rounded-full border border-white/10 bg-[#10152A] px-3.5 py-2 text-xs font-bold"
            >
              {b}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#AEB5D0]">
          Certains badges s'achètent avec des Blox, d'autres se gagnent grâce aux défis ou à des
          événements.
        </p>
        <Link
          to="/store"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#10152A] py-3 text-sm font-black"
        >
          Voir le Blox Store
        </Link>
      </section>

      {/* 20-21. Personalization + gifts */}
      <section className="mt-8 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/10 bg-[#10152A]/80 p-4">
          <Palette className="h-5 w-5 text-[#3B82F6]" />
          <p className="mt-2 text-sm font-black">Personnalise ton profil</p>
          <p className="mt-0.5 text-[11px] text-[#AEB5D0]">
            Polices, halos et bannières animées avec Spark Plus.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#10152A]/80 p-4">
          <Gift className="h-5 w-5 text-[#EC4899]" />
          <p className="mt-2 text-sm font-black">Soutiens les créateurs</p>
          <p className="mt-0.5 text-[11px] text-[#AEB5D0]">
            Envoie des Blox à tes créateurs préférés, dans un commentaire ou en message privé.
          </p>
        </div>
      </section>

      {/* 22. FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-black">FAQ</h2>
        <p className="mt-1 text-sm text-[#AEB5D0]">Tu as des questions ? On a les réponses !</p>
        <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#10152A]">
          {faq.map((item, i) => (
            <div key={item.q}>
              <button
                onClick={() => setOpenFaq((cur) => (cur === i ? null : i))}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold">{item.q}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#AEB5D0] transition-transform",
                    openFaq === i && "rotate-180",
                  )}
                />
              </button>
              {openFaq === i ? (
                <p className="bx-pop px-4 pb-4 text-sm leading-relaxed text-[#AEB5D0]">{item.a}</p>
              ) : null}
            </div>
          ))}
        </div>
        <a
          href="/shop-terms"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 block text-center text-xs text-[#8B5CF6] underline"
        >
          {t("shopTermsLink")}
        </a>
      </section>

      {/* 23. Trust row */}
      <section className="mt-10 grid grid-cols-2 gap-2.5">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/10 bg-[#10152A]/80 p-3.5"
          >
            <span className="text-lg">{item.emoji}</span>
            <p className="mt-1.5 text-xs font-black">{item.title}</p>
            <p className="mt-0.5 text-[10px] text-[#AEB5D0]">{item.text}</p>
          </div>
        ))}
      </section>

      {/* 24. Support message */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(236,72,153,.12),rgba(139,92,246,.12))] p-4 text-center">
        <p className="text-sm font-black">💗 Soutiens Bloxspark</p>
        <p className="mt-1 text-xs text-[#AEB5D0]">
          Ton soutien nous aide à améliorer la plateforme et à créer de nouvelles fonctionnalités.
        </p>
        <p className="mt-2 text-xs text-[#AEB5D0]">Merci ! ♡</p>
      </div>

      {user ? <GiftBloxSheet open={giftOpen} onClose={() => setGiftOpen(false)} /> : null}

      {confirming ? (
        <PurchaseConfirmSheet
          stage={confirming}
          lang={lang}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setCheckingOut(confirming);
            setConfirming(null);
          }}
        />
      ) : null}

      {checkingOut ? (
        <CheckoutSheet stage={checkingOut} onClose={() => setCheckingOut(null)} />
      ) : null}
    </main>
  );
}

function PackCard({
  pack,
  lang,
  large,
  onBuy,
}: {
  pack: BloxPack;
  lang: string;
  large?: boolean;
  onBuy: () => void;
}) {
  const isPro = pack.id === "pro";
  return (
    <button
      onClick={onBuy}
      className={cn(
        "relative flex flex-col items-center rounded-2xl border p-3 text-center transition active:scale-[0.97]",
        isPro
          ? "border-[#a855f7]/60 bg-[#150e2e] shadow-[0_0_30px_-8px_rgba(168,85,247,.65)]"
          : "border-white/10 bg-[#10152A]",
        large && "flex-row gap-3 p-4 text-left",
      )}
    >
      {isPro ? (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] px-2.5 py-0.5 text-[9px] font-black">
          🔥 Le plus populaire
        </span>
      ) : null}
      <span
        className={cn("text-2xl", large && "shrink-0")}
        style={large ? {} : { filter: `drop-shadow(0 0 10px ${pack.accent}66)` }}
      >
        {pack.emoji}
      </span>
      <div className={cn("min-w-0", large && "flex-1")}>
        <p className="mt-1 text-[11px] font-black text-white">{pack.name}</p>
        {large ? <p className="text-[10px] text-[#AEB5D0]">{pack.tagline}</p> : null}
        <p className="mt-1 flex items-center justify-center gap-1 text-sm font-black text-white sm:text-base">
          {pack.blox.toLocaleString()}
          <BloxIcon className="h-3.5 w-3.5" />
        </p>
        {pack.bonusPercent > 0 ? (
          <p className="mt-0.5 text-[10px] font-black text-emerald-400">
            +{pack.bonusPercent}% bonus
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "mt-2 w-full rounded-full bg-gradient-to-r py-2 text-xs font-black text-white",
          pack.gradient,
          large && "mt-0 w-auto shrink-0 px-4 py-2.5",
        )}
      >
        {pack.priceEur.toLocaleString(lang, { minimumFractionDigits: 2 })} €
      </span>
    </button>
  );
}

function PurchaseConfirmSheet({
  stage,
  lang,
  onCancel,
  onConfirm,
}: {
  stage: NonNullable<CheckoutStage>;
  lang: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isPack = stage.kind === "pack";
  const emoji = isPack ? stage.pack.emoji : "👑";
  const title = isPack ? `${stage.pack.blox.toLocaleString()} Blox` : "Spark Plus";
  const priceEur = isPack ? stage.pack.priceEur : 4.99;
  const priceLabel = `${priceEur.toLocaleString(lang, { minimumFractionDigits: 2 })} €${isPack ? "" : "/mois"}`;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#10152A] p-6 text-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-lg font-black">
          {isPack ? "Acheter des Blox" : "Souscrire à Spark Plus"}
        </p>
        <div className="mt-4 flex flex-col items-center text-center">
          <span className="text-4xl">{emoji}</span>
          <p className="mt-2 flex items-center gap-1.5 text-2xl font-black">
            {title} {isPack ? <BloxIcon className="h-5 w-5" /> : null}
          </p>
          {isPack && stage.pack.bonusPercent > 0 ? (
            <p className="mt-1 text-sm font-bold text-emerald-400">
              +{stage.pack.bonusPercent}% bonus
            </p>
          ) : null}
          <p className="mt-2 text-3xl font-black">{priceLabel}</p>
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-[#AEB5D0]">
          {isPack
            ? "Les Blox seront ajoutés immédiatement à ton solde après confirmation du paiement."
            : "Débloque tous les avantages Spark Plus dès la confirmation du paiement. Annule à tout moment."}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/15 py-3 text-sm font-bold text-[#AEB5D0]"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] py-3 text-sm font-black text-white"
          >
            Continuer
          </button>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#AEB5D0]">
          <Shield className="h-3 w-3" /> Paiement sécurisé par Stripe
        </p>
      </div>
    </div>
  );
}

function CheckoutSheet({
  stage,
  onClose,
}: {
  stage: NonNullable<CheckoutStage>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {stage.kind === "pack" ? (
          <BloxPackCheckout lookupKey={stage.pack.lookupKey} onClose={onClose} />
        ) : (
          <div>
            <button
              onClick={onClose}
              className="mb-1 ml-1 text-xs font-bold text-white/70 hover:text-white"
            >
              ← Retour
            </button>
            <SparkPlusCheckout
              returnUrl={`${window.location.origin}/shop?session_id={CHECKOUT_SESSION_ID}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
