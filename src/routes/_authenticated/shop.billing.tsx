import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  LoaderCircle,
  Receipt,
  RefreshCw,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
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

const COPY = {
  en: {
    overview: "Overview",
    purchases: "Purchases",
    invoices: "Invoices",
    blox: "Blox activity",
    totalSpent: "Total paid",
    payments: "Payments",
    plan: "Membership",
    recent: "Recent activity",
    receipt: "View receipt",
    portal:
      "Payment methods, cancellation and billing details are managed securely through Stripe.",
    shop: "Go to Shop",
    noPurchases: "No purchases yet.",
    retry: "Try again",
    purchaseHistory: "Purchase history",
    subscription: "Subscription",
    oneTime: "One-time purchase",
  },
  fr: {
    overview: "Vue d’ensemble",
    purchases: "Achats",
    invoices: "Factures",
    blox: "Activité Blox",
    totalSpent: "Total payé",
    payments: "Paiements",
    plan: "Abonnement",
    recent: "Activité récente",
    receipt: "Voir le reçu",
    portal:
      "Les moyens de paiement, l’annulation et les informations de facturation sont gérés en toute sécurité par Stripe.",
    shop: "Aller à la boutique",
    noPurchases: "Aucun achat pour l’instant.",
    retry: "Réessayer",
    purchaseHistory: "Historique des achats",
    subscription: "Abonnement",
    oneTime: "Achat unique",
  },
  es: {
    overview: "Resumen",
    purchases: "Compras",
    invoices: "Facturas",
    blox: "Actividad Blox",
    totalSpent: "Total pagado",
    payments: "Pagos",
    plan: "Suscripción",
    recent: "Actividad reciente",
    receipt: "Ver recibo",
    portal:
      "Los métodos de pago, la cancelación y los datos de facturación se gestionan de forma segura con Stripe.",
    shop: "Ir a la tienda",
    noPurchases: "Todavía no hay compras.",
    retry: "Reintentar",
    purchaseHistory: "Historial de compras",
    subscription: "Suscripción",
    oneTime: "Compra única",
  },
  pt: {
    overview: "Visão geral",
    purchases: "Compras",
    invoices: "Faturas",
    blox: "Atividade Blox",
    totalSpent: "Total pago",
    payments: "Pagamentos",
    plan: "Assinatura",
    recent: "Atividade recente",
    receipt: "Ver recibo",
    portal:
      "Métodos de pagamento, cancelamento e dados de cobrança são gerenciados com segurança pela Stripe.",
    shop: "Ir para a loja",
    noPurchases: "Nenhuma compra ainda.",
    retry: "Tentar novamente",
    purchaseHistory: "Histórico de compras",
    subscription: "Assinatura",
    oneTime: "Compra única",
  },
  de: {
    overview: "Übersicht",
    purchases: "Käufe",
    invoices: "Rechnungen",
    blox: "Blox-Aktivität",
    totalSpent: "Gesamt bezahlt",
    payments: "Zahlungen",
    plan: "Mitgliedschaft",
    recent: "Letzte Aktivität",
    receipt: "Beleg anzeigen",
    portal: "Zahlungsmethoden, Kündigung und Rechnungsdaten werden sicher über Stripe verwaltet.",
    shop: "Zum Shop",
    noPurchases: "Noch keine Käufe.",
    retry: "Erneut versuchen",
    purchaseHistory: "Kaufverlauf",
    subscription: "Abonnement",
    oneTime: "Einmalkauf",
  },
  ko: {
    overview: "개요",
    purchases: "구매",
    invoices: "청구서",
    blox: "Blox 활동",
    totalSpent: "총 결제액",
    payments: "결제",
    plan: "멤버십",
    recent: "최근 활동",
    receipt: "영수증 보기",
    portal: "결제 수단, 취소 및 청구 정보는 Stripe에서 안전하게 관리됩니다.",
    shop: "상점으로 이동",
    noPurchases: "아직 구매 내역이 없습니다.",
    retry: "다시 시도",
    purchaseHistory: "구매 내역",
    subscription: "구독",
    oneTime: "일회성 구매",
  },
} as const;

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
  const copy = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const [view, setView] = useState<"overview" | "purchases" | "invoices" | "blox">("overview");

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

  const subscription = useQuery({
    queryKey: ["billing-subscription", user?.id, getStripeEnvironment()],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select(
          "status,current_period_start,current_period_end,cancel_at_period_end,price_id,updated_at",
        )
        .eq("user_id", user!.id)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
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
  const purchases = invoices.data?.purchases ?? [];
  const invoiceRows = invoices.data?.invoices ?? [];
  const totalPaid = purchases.reduce((total, purchase) => total + purchase.amountTotal, 0);
  const currency = purchases[0]?.currency ?? "eur";
  const money = (amount: number, code = currency) =>
    new Intl.NumberFormat(lang, { style: "currency", currency: code.toUpperCase() }).format(
      amount / 100,
    );
  const recentActivity = [
    ...purchases.map((item) => ({
      id: `purchase-${item.id}`,
      date: item.created * 1000,
      label: item.label,
      value: money(item.amountTotal, item.currency),
      positive: false,
    })),
    ...(bloxHistory.data ?? []).map((item) => ({
      id: `blox-${item.id}`,
      date: Date.parse(item.created_at),
      label: BLOX_KIND_LABELS[item.kind] ?? item.kind,
      value: `${item.amount > 0 ? "+" : ""}${item.amount.toLocaleString()} Blox`,
      positive: item.amount > 0,
    })),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/shop" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl font-black">{t("purchasesAndBilling")}</h1>
        {user ? <BloxBalanceChip /> : null}
      </header>

      <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-900 p-6 text-white shadow-[0_25px_70px_-35px_rgba(147,51,234,.9)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-purple-200">
              BloxSpark Billing
            </p>
            <h2 className="mt-2 text-3xl font-black">{copy.overview}</h2>
            <p className="mt-1 max-w-lg text-sm text-purple-100/75">{copy.portal}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <p className="text-xs text-purple-100/70">{copy.totalSpent}</p>
            <p className="mt-1 text-2xl font-black">{money(totalPaid)}</p>
          </div>
        </div>
      </section>

      <nav className="no-scrollbar mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">
        {(
          [
            ["overview", copy.overview],
            ["purchases", copy.purchases],
            ["invoices", copy.invoices],
            ["blox", copy.blox],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "shrink-0 flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition",
              view === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-surface-2",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {invoices.data && "error" in invoices.data ? (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{invoices.data.error}</p>
          <Button variant="outline" size="sm" onClick={() => void invoices.refetch()}>
            <RefreshCw className="h-4 w-4" /> {copy.retry}
          </Button>
        </div>
      ) : null}

      {view === "overview" ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-border bg-card p-5">
            <Crown className="h-6 w-6 text-primary" />
            <p className="mt-3 text-xs font-bold text-muted-foreground">{copy.plan}</p>
            <p className="mt-1 text-lg font-black">{isActive ? "Spark Plus" : "Free"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {subscription.data?.cancel_at_period_end
                ? "Ends at current period"
                : (subscription.data?.status ?? "Active")}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5">
            <WalletCards className="h-6 w-6 text-emerald-500" />
            <p className="mt-3 text-xs font-bold text-muted-foreground">{copy.payments}</p>
            <p className="mt-1 text-lg font-black">{purchases.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {invoiceRows.length} {copy.invoices.toLowerCase()}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5">
            <BloxIcon className="h-6 w-6" />
            <p className="mt-3 text-xs font-bold text-muted-foreground">Blox</p>
            <div className="mt-2">
              <BloxBalanceChip />
            </div>
          </div>
        </div>
      ) : null}

      {view === "overview" || view === "purchases" ? (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <ShoppingBag className="h-5 w-5 text-primary" /> {copy.purchaseHistory}
          </h2>
          {invoices.isLoading ? (
            <div className="mt-4 flex justify-center py-10">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : null}
          {!invoices.isLoading && !purchases.length ? (
            <p className="mt-4 rounded-3xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {copy.noPurchases}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {purchases.map((purchase) => (
              <article key={purchase.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    {purchase.mode === "subscription" ? (
                      <Crown className="h-5 w-5" />
                    ) : (
                      <CreditCard className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{purchase.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {purchase.mode === "subscription" ? copy.subscription : copy.oneTime} ·{" "}
                      {new Date(purchase.created * 1000).toLocaleDateString(lang)}
                    </p>
                  </div>
                  <p className="font-black">{money(purchase.amountTotal, purchase.currency)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {purchase.paymentStatus}
                  </span>
                  {purchase.receiptUrl ? (
                    <a
                      href={purchase.receiptUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 text-xs font-bold text-primary"
                    >
                      {copy.receipt}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {view === "overview" ? (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <CalendarDays className="h-5 w-5 text-primary" /> {copy.recent}
          </h2>
          <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-card">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-border p-4 last:border-0"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.date).toLocaleString(lang)}
                  </p>
                </div>
                <span className={cn("text-sm font-black", item.positive && "text-emerald-500")}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view === "overview" ? (
        <>
          <section className="mt-6 rounded-3xl border border-border bg-card p-5">
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
        </>
      ) : null}

      {view === "overview" || view === "invoices" ? (
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
                {inv.invoicePdf || inv.hostedInvoiceUrl ? (
                  <a
                    href={inv.invoicePdf ?? inv.hostedInvoiceUrl ?? undefined}
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
      ) : null}

      {view === "blox" ? (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <BloxIcon className="h-5 w-5" /> {copy.blox}
          </h2>
          {bloxHistory.isLoading ? (
            <div className="mt-4 flex justify-center py-10">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : null}
          {!bloxHistory.isLoading && !bloxHistory.data?.length ? (
            <p className="mt-4 py-8 text-center text-sm text-muted-foreground">
              {copy.noPurchases}
            </p>
          ) : null}
          <div className="mt-3 space-y-2">
            {(bloxHistory.data ?? []).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {BLOX_KIND_LABELS[tx.kind] ?? tx.kind}
                  </p>
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
      ) : null}

      <Link
        to="/shop"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-black hover:border-primary/40"
      >
        <ShoppingBag className="h-4 w-4" /> {copy.shop}
      </Link>
    </main>
  );
}
