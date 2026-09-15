import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  HelpCircle,
  LoaderCircle,
  Receipt,
  RefreshCw,
  ShoppingBag,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Sheet } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { getStripeEnvironmentSafe } from "@/lib/stripe";
import { createPortalSession, listInvoices } from "@/utils/payments.functions";
import { SparkPlusCheckout } from "@/components/SparkPlusCheckout";
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
    free: "Free",
    active: "Active",
    endsAtPeriod: "Ends at the end of the current period",
    paymentMethods: "Payment methods",
    paymentMethodsHint: "Add, remove or update your card via Stripe's secure portal.",
    manage: "Manage",
    support: "Need help with an order?",
    supportHint: "Our support team can look into any purchase or billing question.",
    contactSupport: "Contact support",
    paymentsUnavailable: "Payments aren't fully set up yet",
    paymentsUnavailableHint:
      "Purchase and invoice history will appear here once payments are configured for this project. Your Blox activity below is unaffected.",
    details: "Details",
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
    free: "Gratuit",
    active: "Actif",
    endsAtPeriod: "Se termine à la fin de la période en cours",
    paymentMethods: "Moyens de paiement",
    paymentMethodsHint: "Ajoute, supprime ou modifie ta carte via le portail sécurisé Stripe.",
    manage: "Gérer",
    support: "Besoin d'aide sur une commande ?",
    supportHint: "Notre équipe support peut t'aider pour tout achat ou question de facturation.",
    contactSupport: "Contacter le support",
    paymentsUnavailable: "Les paiements ne sont pas encore entièrement configurés",
    paymentsUnavailableHint:
      "L'historique des achats et factures s'affichera ici une fois les paiements configurés pour ce projet. Ton activité Blox ci-dessous n'est pas concernée.",
    details: "Détails",
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
    free: "Gratis",
    active: "Activo",
    endsAtPeriod: "Termina al final del periodo actual",
    paymentMethods: "Métodos de pago",
    paymentMethodsHint: "Añade, elimina o actualiza tu tarjeta desde el portal seguro de Stripe.",
    manage: "Gestionar",
    support: "¿Necesitas ayuda con un pedido?",
    supportHint: "Nuestro equipo de soporte puede ayudarte con cualquier compra o factura.",
    contactSupport: "Contactar con soporte",
    paymentsUnavailable: "Los pagos aún no están completamente configurados",
    paymentsUnavailableHint:
      "El historial de compras y facturas aparecerá aquí en cuanto los pagos estén configurados. Tu actividad de Blox abajo no se ve afectada.",
    details: "Detalles",
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
    free: "Grátis",
    active: "Ativo",
    endsAtPeriod: "Termina no fim do período atual",
    paymentMethods: "Métodos de pagamento",
    paymentMethodsHint: "Adicione, remova ou atualize seu cartão pelo portal seguro da Stripe.",
    manage: "Gerenciar",
    support: "Precisa de ajuda com um pedido?",
    supportHint: "Nossa equipe de suporte pode ajudar com qualquer compra ou fatura.",
    contactSupport: "Contatar suporte",
    paymentsUnavailable: "Os pagamentos ainda não estão totalmente configurados",
    paymentsUnavailableHint:
      "O histórico de compras e faturas aparecerá aqui assim que os pagamentos forem configurados. Sua atividade Blox abaixo não é afetada.",
    details: "Detalhes",
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
    free: "Kostenlos",
    active: "Aktiv",
    endsAtPeriod: "Endet am Ende der aktuellen Periode",
    paymentMethods: "Zahlungsmethoden",
    paymentMethodsHint: "Karte über das sichere Stripe-Portal hinzufügen, entfernen oder ändern.",
    manage: "Verwalten",
    support: "Hilfe zu einer Bestellung?",
    supportHint: "Unser Support hilft bei jeder Kauf- oder Rechnungsfrage weiter.",
    contactSupport: "Support kontaktieren",
    paymentsUnavailable: "Zahlungen sind noch nicht vollständig eingerichtet",
    paymentsUnavailableHint:
      "Kauf- und Rechnungsverlauf erscheinen hier, sobald Zahlungen konfiguriert sind. Deine Blox-Aktivität unten ist davon nicht betroffen.",
    details: "Details",
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
    free: "무료",
    active: "활성",
    endsAtPeriod: "현재 결제 주기 종료 시 만료",
    paymentMethods: "결제 수단",
    paymentMethodsHint: "Stripe의 안전한 포털에서 카드를 추가, 삭제 또는 변경하세요.",
    manage: "관리",
    support: "주문 관련 도움이 필요하신가요?",
    supportHint: "구매나 결제 관련 문의는 고객지원팀이 도와드려요.",
    contactSupport: "고객지원팀 문의",
    paymentsUnavailable: "결제 기능이 아직 완전히 설정되지 않았어요",
    paymentsUnavailableHint:
      "결제가 설정되면 구매 및 청구서 내역이 여기에 표시돼요. 아래 Blox 활동에는 영향이 없어요.",
    details: "세부 정보",
  },
} as const;

export const Route = createFileRoute("/_authenticated/shop_/billing")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } =>
    typeof search["session_id"] === "string" ? { session_id: search["session_id"] } : {},
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
  const navigate = useNavigate();
  const { session_id: newSubscriptionSessionId } = Route.useSearch();
  const copy = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const [view, setView] = useState<"overview" | "purchases" | "invoices" | "blox">("overview");
  const [subscribing, setSubscribing] = useState(false);

  // getStripeEnvironment() throws when Stripe isn't configured for this
  // build - computed once, safely, here rather than inline in a queryKey
  // (which would crash this whole page's render every time, unconditionally,
  // instead of just disabling the Stripe-dependent sections below).
  const stripeEnv = getStripeEnvironmentSafe();
  const paymentsConfigured = stripeEnv !== null;

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
    queryKey: ["billing-subscription", user?.id, stripeEnv],
    enabled: !!user && paymentsConfigured,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select(
          "status,current_period_start,current_period_end,cancel_at_period_end,price_id,updated_at",
        )
        .eq("user_id", user!.id)
        .eq("environment", stripeEnv!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ["billing-invoices", user?.id, stripeEnv],
    enabled: !!user && paymentsConfigured,
    queryFn: () => listInvoices({ data: { environment: stripeEnv! } }),
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

  // Landed back here after subscribing to Spark Plus from this very page
  // (see the "no active plan" card below) - confirm it, then drop the
  // session id from the URL so refreshing doesn't re-trigger the toast.
  useEffect(() => {
    if (!newSubscriptionSessionId) return;
    toast.success(t("purchaseThankYouSparkPlusBody"));
    void navigate({ to: "/shop/billing", search: {}, replace: true });
  }, [newSubscriptionSessionId, navigate, t]);

  async function manageSubscription() {
    if (!paymentsConfigured) return;
    try {
      const result = await createPortalSession({
        data: { returnUrl: window.location.href, environment: stripeEnv! },
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
  const purchases = invoices.data && !("error" in invoices.data) ? invoices.data.purchases : [];
  const invoiceRows = invoices.data && !("error" in invoices.data) ? invoices.data.invoices : [];
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
        <button
          onClick={() => window.history.back()}
          aria-label={t("back")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
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

      {!paymentsConfigured ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
              {copy.paymentsUnavailable}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.paymentsUnavailableHint}</p>
          </div>
        </div>
      ) : invoices.data && "error" in invoices.data ? (
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
            <p className="mt-1 text-lg font-black">{isActive ? "Spark Plus" : copy.free}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {subscription.data?.cancel_at_period_end
                ? copy.endsAtPeriod
                : (subscription.data?.status ?? copy.active)}
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

      {view === "overview" ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-5">
            <CreditCard className="h-6 w-6 text-primary" />
            <p className="mt-3 font-black">{copy.paymentMethods}</p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.paymentMethodsHint}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              disabled={!paymentsConfigured}
              onClick={() => void manageSubscription()}
            >
              {copy.manage}
            </Button>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5">
            <HelpCircle className="h-6 w-6 text-primary" />
            <p className="mt-3 font-black">{copy.support}</p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.supportHint}</p>
            <Link
              to="/support"
              className="mt-3 flex h-9 w-full items-center justify-center rounded-2xl border border-border text-sm font-bold hover:border-primary/40"
            >
              {copy.contactSupport}
            </Link>
          </div>
        </section>
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
            <div className="mt-4 rounded-3xl border border-dashed border-border py-10 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">{copy.noPurchases}</p>
            </div>
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
            {recentActivity.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{copy.noPurchases}</p>
            ) : (
              recentActivity.map((item) => (
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
              ))
            )}
          </div>
        </section>
      ) : null}

      {view === "overview" ? (
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
              <Button
                className="mt-4 w-full"
                disabled={!paymentsConfigured}
                onClick={() => void manageSubscription()}
              >
                {t("manageSubscription")}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">{t("billingNoSubscription")}</p>
              <Button
                className="mt-4 w-full"
                disabled={!paymentsConfigured}
                onClick={() => setSubscribing(true)}
              >
                <Crown className="h-4 w-4" /> {t("subscribeSparkPlus")}
              </Button>
            </>
          )}
        </section>
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
          {!invoices.isLoading && !invoiceRows.length ? (
            <div className="mt-4 rounded-3xl border border-dashed border-border py-10 text-center">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {t("billingNoInvoices")}
              </p>
            </div>
          ) : null}
          <div className="mt-3 space-y-2">
            {invoiceRows.map((inv) => (
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

      {subscribing ? (
        <Sheet open onClose={() => setSubscribing(false)} title={t("subscribeSparkPlus")}>
          <button
            onClick={() => setSubscribing(false)}
            aria-label={t("cancel")}
            className="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> {t("cancel")}
          </button>
          <SparkPlusCheckout
            returnUrl={`${window.location.origin}/shop/billing?session_id={CHECKOUT_SESSION_ID}`}
          />
        </Sheet>
      ) : null}
    </main>
  );
}
