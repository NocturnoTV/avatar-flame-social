import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Download, LoaderCircle, Receipt, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession, listInvoices } from "@/utils/payments.functions";
import { BloxIcon, BloxBalanceChip } from "@/components/Blox";
import { cn } from "@/lib/utils";

const BLOX_KIND_LABELS: Record<string, string> = {
  purchase: "Achat de pack Blox",
  gift_sent: "Blox offerts",
  gift_received: "Blox reçus en cadeau",
  quest_reward: "Récompense de défi quotidien",
  badge_purchase: "Achat de badge",
  refund: "Remboursement",
};

export const Route = createFileRoute("/_authenticated/shop/billing")({
  head: () => ({
    meta: [
      { title: "Achats & Facturation - Bloxspark" },
      { name: "description", content: "Ton abonnement Spark Plus et tes factures." },
    ],
  }),
  component: BillingPage,
});

const STATUS_KEYS: Record<string, string> = {
  paid: "billingStatusPaid",
  open: "billingStatusOpen",
  draft: "billingStatusDraft",
  void: "billingStatusVoid",
  uncollectible: "billingStatusUncollectible",
};

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-500",
  open: "bg-amber-500/10 text-amber-500",
  draft: "bg-muted text-muted-foreground",
  void: "bg-muted text-muted-foreground",
  uncollectible: "bg-red-500/10 text-red-500",
};

function BillingPage() {
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

  const invoices = useQuery({
    queryKey: ["billing-invoices", user?.id],
    enabled: !!user,
    queryFn: () => listInvoices({ data: { environment: getStripeEnvironment() } }),
  });

  const bloxHistory = useQuery({
    queryKey: ["billing-blox-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("blox_transactions")
        .select("id,amount,kind,description,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
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

  const expiration = membership.data?.spark_plus_expires_at;
  const isActive = Boolean(
    membership.data?.spark_plus_active &&
    (!expiration || new Date(expiration).getTime() > Date.now()),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/shop" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl font-black">{t("purchasesAndBilling")}</h1>
        {user ? <BloxBalanceChip /> : null}
      </header>

      <section className="mt-5 rounded-3xl border border-border bg-card p-5">
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
          {t("billingCurrentPlan")}
        </p>
        {isActive ? (
          <>
            <div className="mt-2 flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <p className="text-lg font-black">Spark Plus - 4,99 €/{t("month")}</p>
            </div>
            {expiration ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("renewsOn", { date: new Date(expiration).toLocaleDateString(lang) })}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">{t("billingCancelHint")}</p>
            <Button className="mt-4 w-full" onClick={() => void manageSubscription()}>
              {t("manageSubscription")}
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{t("billingNoSubscription")}</p>
            <Link
              to="/shop"
              className="mt-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground"
            >
              <Crown className="h-4 w-4" /> {t("subscribeSparkPlus")}
            </Link>
          </>
        )}
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Receipt className="h-5 w-5 text-primary" /> {t("billingInvoices")}
        </h2>
        {invoices.isLoading ? (
          <div className="mt-4 flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : null}
        {!invoices.isLoading && !invoices.data?.invoices.length ? (
          <p className="mt-4 py-8 text-center text-sm text-muted-foreground">
            {t("billingNoInvoices")}
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {(invoices.data?.invoices ?? []).map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {inv.number ?? inv.id} ·{" "}
                  {new Intl.NumberFormat(lang, {
                    style: "currency",
                    currency: inv.currency,
                  }).format(inv.amountPaid / 100)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(inv.created * 1000).toLocaleDateString(lang, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                  STATUS_COLORS[inv.status ?? ""] ?? "bg-muted text-muted-foreground",
                )}
              >
                {t(STATUS_KEYS[inv.status ?? ""] ?? "billingStatusDraft")}
              </span>
              {inv.invoicePdf ? (
                <a
                  href={inv.invoicePdf}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t("billingViewInvoice")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-primary"
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <BloxIcon className="h-5 w-5" /> Historique Blox
        </h2>
        {bloxHistory.isLoading ? (
          <div className="mt-4 flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : null}
        {!bloxHistory.isLoading && !bloxHistory.data?.length ? (
          <p className="mt-4 py-8 text-center text-sm text-muted-foreground">
            Aucune transaction Blox pour l'instant.
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {(bloxHistory.data ?? []).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{BLOX_KIND_LABELS[tx.kind] ?? tx.kind}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {tx.description ??
                    new Date(tx.created_at).toLocaleDateString(lang, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                </p>
              </div>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 text-sm font-black",
                  tx.amount < 0 ? "text-destructive" : "text-emerald-500",
                )}
              >
                {tx.amount > 0 ? "+" : ""}
                {tx.amount.toLocaleString()} <BloxIcon className="h-3.5 w-3.5" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <Link
        to="/shop"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-black hover:border-primary/40"
      >
        <ShoppingBag className="h-4 w-4" /> Aller à la boutique
      </Link>
    </main>
  );
}
