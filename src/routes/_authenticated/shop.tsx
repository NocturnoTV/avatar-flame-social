import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Gift,
  Headphones,
  Lock,
  Megaphone,
  Palette,
  Rocket,
  Shield,
  Sparkles,
  Zap,
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
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { Button, Sheet } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/native";

export const Route = createFileRoute("/_authenticated/shop")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { session_id?: string; blox_session_id?: string } => ({
    ...(typeof search["session_id"] === "string" ? { session_id: search["session_id"] } : {}),
    ...(typeof search["blox_session_id"] === "string"
      ? { blox_session_id: search["blox_session_id"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Boutique Blox & Spark Plus - Bloxspark" },
      {
        name: "description",
        content:
          "Achète des Blox, active Spark Plus et personnalise ton profil Bloxspark. Paiement sécurisé, crédit instantané.",
      },
      { property: "og:title", content: "Boutique Blox & Spark Plus - Bloxspark" },
      {
        property: "og:description",
        content: "Packs de Blox, abonnement Spark Plus et badges exclusifs sur Bloxspark.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

const USES = [
  { icon: Rocket, title: "Booster tes vidéos", text: "Plus de visibilité dans le feed" },
  { icon: Award, title: "Badges", text: "Affiche ton style sur ton profil" },
  { icon: Palette, title: "Personnalisation", text: "Thèmes, halos et effets" },
  { icon: Gift, title: "Cadeaux", text: "Soutiens tes créateurs préférés" },
  { icon: Megaphone, title: "Mise en avant", text: "Sois vu par plus de monde" },
];

const QUEST_EXAMPLES = [
  { title: "Social Spark", text: "Aime 10 publications", reward: 30 },
  { title: "Conversation", text: "Commente 3 publications", reward: 40 },
  { title: "Creator", text: "Publie une vidéo", reward: 50 },
  { title: "Explorer", text: "Visite 10 profils", reward: 25 },
];

const PLUS_FEATURES = [
  "Badge Spark Plus exclusif",
  "Effets et thèmes premium",
  "Statistiques avancées",
  "Personnalisation complète",
  "Support prioritaire",
];

const TRUST_ITEMS = [
  { icon: Zap, title: "Crédit instantané", text: "Tes Blox arrivent dès le paiement" },
  { icon: Lock, title: "Paiement sécurisé", text: "Traité par Stripe" },
  { icon: CreditCard, title: "Moyens de paiement", text: "Carte, Apple Pay, Google Pay" },
  { icon: Headphones, title: "Assistance", text: "Notre équipe répond" },
];

type CheckoutStage = { kind: "pack"; pack: BloxPack } | { kind: "plus" } | null;

function ShopPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const navigate = useNavigate();
  const { session_id: sparkPlusSessionId, blox_session_id: bloxSessionId } = Route.useSearch();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [confirming, setConfirming] = useState<CheckoutStage>(null);
  const [checkingOut, setCheckingOut] = useState<CheckoutStage>(null);
  const [thankYou, setThankYou] = useState<{ kind: "blox" | "spark_plus"; amount?: number } | null>(
    null,
  );

  // Landed back here from Stripe's embedded checkout after a completed
  // purchase - look up the exact Blox amount the webhook credited (it runs
  // right around the same time as this redirect, so retry briefly), show a
  // thank-you popup, then strip the session id from the URL.
  const boughtBlox = useQuery({
    queryKey: ["shop-purchase-lookup", bloxSessionId],
    enabled: !!bloxSessionId,
    refetchInterval: (query) => (query.state.data ? false : 1500),
    queryFn: async () => {
      const { data } = await supabase
        .from("blox_transactions")
        .select("amount")
        .eq("reference_id", bloxSessionId!)
        .eq("kind", "purchase")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!bloxSessionId) return;
    if (boughtBlox.data) {
      setThankYou({ kind: "blox", amount: boughtBlox.data.amount });
      void navigate({ to: "/shop", search: {}, replace: true });
    }
  }, [bloxSessionId, boughtBlox.data, navigate]);

  useEffect(() => {
    if (!sparkPlusSessionId) return;
    setThankYou({ kind: "spark_plus" });
    void navigate({ to: "/shop", search: {}, replace: true });
  }, [sparkPlusSessionId, navigate]);

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
      void openExternal(result.url);
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

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-5 text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link
          to="/home"
          aria-label={t("back")}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Link>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Boutique
        </p>
        {user ? (
          <a
            href="#packs"
            className="flex h-10 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold"
          >
            <BloxBalanceChip className="border-0 bg-transparent px-0 py-0" />
          </a>
        ) : (
          <span className="w-10" />
        )}
      </header>

      {/* Hero */}
      <section className="mt-7">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          Recharge ton compte en Blox
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Les Blox alimentent tout Bloxspark : boosts de vidéos, badges, personnalisation et
          cadeaux. Crédit immédiat, paiement sécurisé, aucun abonnement requis.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Crédit instantané
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Paiement sécurisé Stripe
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Sans engagement
          </span>
        </div>
      </section>

      {/* Packs */}
      <section id="packs" className="mt-8 scroll-mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold tracking-tight">Packs de Blox</h2>
          <span className="text-xs text-muted-foreground">Achat unique</span>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {BLOX_PACKS.map((pack, i) => (
            <PackRow
              key={pack.lookupKey}
              pack={pack}
              lang={lang}
              first={i === 0}
              onBuy={() => setConfirming({ kind: "pack", pack })}
            />
          ))}
        </div>

        <button
          onClick={() => setGiftOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Gift className="h-4 w-4" /> {t("giftBlox")}
        </button>
      </section>

      {/* Spark Plus */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold tracking-tight">Abonnement</h2>
          <span className="text-xs text-muted-foreground">Mensuel</span>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Sparkles className="h-4.5 w-4.5 text-primary" /> Spark Plus
              </p>
              <p className="mt-1 text-sm text-muted-foreground">L'expérience Bloxspark complète.</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold tracking-tight">4,99 €</p>
              <p className="text-xs text-muted-foreground">/{t("month")}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PLUS_FEATURES.map((f) => (
              <p key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 shrink-0 text-primary" /> {f}
              </p>
            ))}
          </div>

          {isActive ? (
            <div className="mt-6 border-t border-border pt-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck className="h-4.5 w-4.5 text-primary" /> {t("sparkPlusActive")}
              </p>
              {expiration ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("renewsOn", { date: new Date(expiration).toLocaleDateString(lang) })}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void manageSubscription()}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  {t("manageSubscription")}
                </button>
                <Link
                  to="/shop/billing"
                  className="flex flex-1 items-center justify-center rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  {t("purchasesAndBilling")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirming({ kind: "plus" })}
                className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Activer Spark Plus
              </button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Annulable à tout moment, sans engagement.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Uses */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">À quoi servent les Blox</h2>
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {USES.map((use) => (
            <div key={use.title} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <use.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{use.title}</p>
                <p className="text-xs text-muted-foreground">{use.text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Le boost de vidéo se lance depuis le Creator Studio. Il augmente ta visibilité dans le
          feed et ne génère jamais de faux likes, vues ou abonnés.
        </p>
      </section>

      {/* Free Blox */}
      <section className="mt-10">
        <Link
          to="/rewards"
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Gift className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Gagne des Blox gratuitement</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Défis quotidiens, événements et activité sur Bloxspark.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {QUEST_EXAMPLES.map((q) => (
            <div
              key={q.title}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{q.title}</p>
                <p className="text-xs text-muted-foreground">{q.text}</p>
              </div>
              <p className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                +{q.reward} <BloxIcon className="h-3.5 w-3.5" />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Badges */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">Badges</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Certains badges s'achètent avec des Blox, d'autres se gagnent.
        </p>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {["Early Member", "Gamer", "Creator", "Veteran", "Supporter", "Elite"].map((b) => (
            <span
              key={b}
              className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {b}
            </span>
          ))}
        </div>
        <Link
          to="/store"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium transition hover:border-primary/40"
        >
          Voir le Blox Store <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">Questions fréquentes</h2>
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {faq.map((item, i) => (
            <div key={item.q}>
              <button
                onClick={() => setOpenFaq((cur) => (cur === i ? null : i))}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="min-w-0 flex-1 text-sm font-medium">{item.q}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    openFaq === i && "rotate-180",
                  )}
                />
              </button>
              {openFaq === i ? (
                <p className="bx-pop px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <a
          href="/shop-terms"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 block text-center text-xs text-muted-foreground underline"
        >
          {t("shopTermsLink")}
        </a>
      </section>

      {/* Trust */}
      <section className="mt-10 grid gap-2 sm:grid-cols-2">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        Les Blox sont une monnaie virtuelle utilisable uniquement sur Bloxspark. Bloxspark n'est pas
        affilié à Roblox Corporation.
      </p>

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

      <Sheet open={!!thankYou} onClose={() => setThankYou(null)}>
        <div className="flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-9 w-9" />
          </span>
          <h2 className="mt-3 text-xl font-black">{t("purchaseThankYouTitle")}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {thankYou?.kind === "blox"
              ? t("purchaseThankYouBloxBody", {
                  amount: (thankYou.amount ?? 0).toLocaleString(),
                })
              : t("purchaseThankYouSparkPlusBody")}
          </p>
          <div className="mt-5 flex w-full flex-col gap-2">
            {thankYou?.kind === "blox" ? (
              <Button className="w-full" onClick={() => setThankYou(null)}>
                <BloxIcon className="h-4 w-4" /> {t("viewBloxStore")}
              </Button>
            ) : (
              <Button className="w-full" onClick={() => setThankYou(null)}>
                {t("ok")}
              </Button>
            )}
          </div>
        </div>
      </Sheet>
    </main>
  );
}

function PackRow({
  pack,
  lang,
  first,
  onBuy,
}: {
  pack: BloxPack;
  lang: string;
  first?: boolean;
  onBuy: () => void;
}) {
  const popular = pack.id === "pro";
  return (
    <button
      onClick={onBuy}
      className={cn(
        "flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-muted/40",
        !first && "border-t border-border",
        popular && "bg-muted/30",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
        <BloxIcon className="h-4.5 w-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {pack.blox.toLocaleString(lang)} Blox
          {popular ? (
            <span className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Populaire
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {pack.bonusPercent > 0 ? `+${pack.bonusPercent}% de Blox offerts · ` : ""}
          {pack.tagline}
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold",
          popular ? "bg-primary text-primary-foreground" : "border border-border text-foreground",
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
  const title = isPack ? `${stage.pack.blox.toLocaleString(lang)} Blox` : "Spark Plus";
  const priceEur = isPack ? stage.pack.priceEur : 4.99;
  const priceLabel = `${priceEur.toLocaleString(lang, { minimumFractionDigits: 2 })} €${isPack ? "" : ` /mois`}`;

  // Portaled straight to <body> - some Android WebViews mis-render "fixed"
  // nested deep in a tall/scrollable ancestor, showing it mid-page or at
  // the very bottom instead of pinned to the screen.
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {isPack ? "Confirmer l'achat" : "Confirmer l'abonnement"}
        </p>

        <div className="mt-4 flex items-baseline justify-between border-b border-border pb-4">
          <p className="text-lg font-semibold">{title}</p>
          <p className="text-lg font-semibold">{priceLabel}</p>
        </div>

        {isPack && stage.pack.bonusPercent > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Inclut +{stage.pack.bonusPercent}% de Blox offerts.
          </p>
        ) : null}

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {isPack
            ? "Les Blox sont ajoutés à ton solde dès la confirmation du paiement."
            : "Tous les avantages Spark Plus sont débloqués dès la confirmation du paiement. Annulable à tout moment."}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            Continuer
          </button>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> Paiement sécurisé par Stripe
        </p>
      </div>
    </div>,
    document.body,
  );
}

function CheckoutSheet({
  stage,
  onClose,
}: {
  stage: NonNullable<CheckoutStage>;
  onClose: () => void;
}) {
  // Portaled straight to <body> - see PurchaseConfirmSheet above.
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
              className="mb-1 ml-1 text-xs font-medium text-white/70 hover:text-white"
            >
              ← Retour
            </button>
            <SparkPlusCheckout
              returnUrl={`${window.location.origin}/shop?session_id={CHECKOUT_SESSION_ID}`}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
