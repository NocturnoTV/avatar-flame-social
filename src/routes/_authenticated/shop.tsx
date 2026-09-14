import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  Clapperboard,
  Crown,
  MessageSquareHeart,
  Receipt,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { SparkPlusCheckout } from "@/components/SparkPlusCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Spark Plus — Bloxspark" },
      { name: "description", content: "Débloque des personnalisations exclusives sur Bloxspark." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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

  const [checkoutOpen, setCheckoutOpen] = useState(false);

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

  const benefits = [
    { icon: WandSparkles, title: t("plusBenefitProfile"), text: t("plusBenefitProfileText") },
    { icon: Clapperboard, title: t("plusBenefitBanner"), text: t("plusBenefitBannerText") },
    { icon: Sparkles, title: t("plusBenefitBoost"), text: t("plusBenefitBoostText") },
    { icon: Crown, title: t("plusBenefitFonts"), text: t("plusBenefitFontsText") },
    { icon: MessageSquareHeart, title: t("plusBenefitChat"), text: t("plusBenefitChatText") },
    { icon: BadgeCheck, title: t("plusBenefitBadge"), text: t("plusBenefitBadgeText") },
  ];

  const faq = [
    { q: t("shopFaqCancelQ"), a: t("shopFaqCancelA") },
    { q: t("shopFaqCustomizationQ"), a: t("shopFaqCustomizationA") },
    { q: t("shopFaqRenewQ"), a: t("shopFaqRenewA") },
    { q: t("shopFaqPaymentQ"), a: t("shopFaqPaymentA") },
    { q: t("shopFaqInvoiceQ"), a: t("shopFaqInvoiceA") },
  ];

  const expiration = membership.data?.spark_plus_expires_at;
  const isActive = Boolean(
    membership.data?.spark_plus_active &&
    (!expiration || new Date(expiration).getTime() > Date.now()),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <PaymentTestModeBanner />
      <header className="mt-3 flex items-center gap-3">
        <Link to="/home" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-black">{t("shop")}</h1>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[2.25rem] bg-[radial-gradient(circle_at_15%_0%,#c084fc_0%,transparent_45%),linear-gradient(135deg,#3b0764_0%,#7c3aed_55%,#a855f7_100%)] p-6 text-white shadow-2xl shadow-primary/30 sm:p-8">
        <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] backdrop-blur">
            <Crown className="h-3.5 w-3.5" /> Bloxspark
          </span>
          <h2 className="mt-3 text-4xl font-black">Spark Plus</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">{t("sparkPlusHero")}</p>
          <div className="mt-6 flex items-end gap-2">
            <span className="text-4xl font-black">4,99 €</span>
            <span className="pb-1 text-sm text-white/70">/{t("month")}</span>
          </div>
          {isActive ? (
            <div className="mt-6 rounded-2xl bg-white/15 p-4 backdrop-blur">
              <p className="flex items-center gap-2 font-black">
                <Check className="h-5 w-5" /> {t("sparkPlusActive")}
              </p>
              {expiration ? (
                <p className="mt-1 text-xs text-white/75">
                  {t("renewsOn", { date: new Date(expiration).toLocaleDateString(lang) })}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1 bg-white text-primary hover:bg-white/90"
                  onClick={() => void manageSubscription()}
                >
                  {t("manageSubscription")}
                </Button>
                <Link
                  to="/shop/billing"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/40 px-4 py-2.5 text-sm font-bold hover:bg-white/10"
                >
                  <Receipt className="h-4 w-4" /> {t("purchasesAndBilling")}
                </Link>
              </div>
            </div>
          ) : checkoutOpen ? null : (
            <Button
              className="mt-6 w-full bg-white text-primary hover:bg-white/90"
              onClick={() => setCheckoutOpen(true)}
            >
              <Crown className="h-4 w-4" /> {t("subscribeSparkPlus")}
            </Button>
          )}
        </div>
      </section>

      {!isActive && checkoutOpen ? <SparkPlusCheckout /> : null}

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {benefits.map((benefit) => (
          <article
            key={benefit.title}
            className="rounded-3xl border border-primary/15 bg-card p-5 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <benefit.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-black">{benefit.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-black">{t("shopFaqTitle")}</h2>
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {faq.map((item, i) => (
            <div key={item.q}>
              <button
                onClick={() => setOpenFaq((cur) => (cur === i ? null : i))}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold">{item.q}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    openFaq === i && "rotate-180",
                  )}
                />
              </button>
              {openFaq === i ? (
                <p className="bx-pop px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">{t("sparkPlusLegal")}</p>
    </main>
  );
}
