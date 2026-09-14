import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, Check, Crown, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { SparkPlusCheckout } from "@/components/SparkPlusCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({ meta: [{ title: "Spark Plus — Bloxspark" }] }),
  component: ShopPage,
});

function ShopPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
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

  async function subscribe() {
    try {
      const checkout = await createSparkPlusCheckout();
      window.location.assign(checkout.url);
    } catch {
      toast.error(t("sparkPlusCheckoutUnavailable"));
    }
  }

  const benefits = [
    { icon: WandSparkles, title: t("plusBenefitProfile"), text: t("plusBenefitProfileText") },
    { icon: Sparkles, title: t("plusBenefitBoost"), text: t("plusBenefitBoostText") },
    { icon: Crown, title: t("plusBenefitFonts"), text: t("plusBenefitFontsText") },
    { icon: BadgeCheck, title: t("plusBenefitBadge"), text: t("plusBenefitBadgeText") },
  ];
  const expiration = membership.data?.spark_plus_expires_at;
  const isActive = Boolean(
    membership.data?.spark_plus_active &&
    (!expiration || new Date(expiration).getTime() > Date.now()),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-black">{t("shop")}</h1>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-blue-950 via-blue-700 to-cyan-400 p-6 text-white shadow-2xl shadow-blue-600/25 sm:p-8">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <Crown className="h-10 w-10 text-cyan-200" />
        <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
          Bloxspark
        </p>
        <h2 className="mt-1 text-4xl font-black">Spark Plus</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">{t("sparkPlusHero")}</p>
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
                {t("renewsOn", {
                  date: new Date(expiration).toLocaleDateString(lang),
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <Button
            className="mt-6 w-full bg-white text-blue-700 hover:bg-blue-50"
            onClick={() => void subscribe()}
          >
            <Crown className="h-4 w-4" /> {t("subscribeSparkPlus")}
          </Button>
        )}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {benefits.map((benefit) => (
          <article key={benefit.title} className="rounded-3xl border border-primary/15 bg-card p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <benefit.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-black">{benefit.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p>
          </article>
        ))}
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">{t("sparkPlusLegal")}</p>
    </main>
  );
}
