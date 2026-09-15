import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };
export type InvoiceRow = {
  id: string;
  number: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: number;
  hostedInvoiceUrl: string | null | undefined;
  invoicePdf: string | null | undefined;
};
export type PurchaseRow = {
  id: string;
  label: string;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  status: string | null;
  mode: string;
  created: number;
  receiptUrl: string | null;
};
type InvoicesResult =
  | { invoices: InvoiceRow[]; purchases: PurchaseRow[]; customer: boolean }
  | { invoices: []; purchases: []; customer: false; error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length && found.data[0]) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createSparkPlusCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const {
        data: { user },
      } = await context.supabase.auth.getUser();

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");

      const customerId = await resolveOrCreateCustomer(stripe, {
        ...(user?.email ? { email: user.email } : {}),
        userId: context.userId,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: { userId: context.userId, managed_payments: "true" },
        subscription_data: { metadata: { userId: context.userId } },
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createBloxPackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      lookupKey: string;
      returnUrl: string;
      environment: StripeEnv;
      recipientId?: string;
      conversationId?: string;
      /** Personal note attached to the "gift" message posted once payment
       * completes - Stripe metadata values cap at 500 bytes, so this is
       * trimmed hard well below that. */
      note?: string;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.lookupKey)) throw new Error("Invalid lookupKey");
      if (data.recipientId && !/^[a-zA-Z0-9_-]+$/.test(data.recipientId)) {
        throw new Error("Invalid recipientId");
      }
      if (data.conversationId && !/^[a-zA-Z0-9_-]+$/.test(data.conversationId)) {
        throw new Error("Invalid conversationId");
      }
      if (data.note) data.note = data.note.slice(0, 140);
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const {
        data: { user },
      } = await context.supabase.auth.getUser();

      const prices = await stripe.prices.list({ lookup_keys: [data.lookupKey] });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");

      const customerId = await resolveOrCreateCustomer(stripe, {
        ...(user?.email ? { email: user.email } : {}),
        userId: context.userId,
      });

      // A gift keeps the payer as the billed customer but credits Blox to
      // `recipientId` instead - the webhook falls back to `userId` when
      // this is absent (buying for yourself).
      const metadata: Record<string, string> = {
        userId: context.userId,
        managed_payments: "true",
        kind: "blox_pack",
        ...(data.recipientId ? { recipientId: data.recipientId } : {}),
        ...(data.conversationId ? { conversationId: data.conversationId } : {}),
        ...(data.note ? { note: data.note } : {}),
      };

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        allow_promotion_codes: true,
        managed_payments: { enabled: true },
        metadata,
        payment_intent_data: { metadata },
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createSparkPlusGiftCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      recipientId: string;
      returnUrl: string;
      environment: StripeEnv;
      conversationId?: string;
      note?: string;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.recipientId)) throw new Error("Invalid recipientId");
      if (data.conversationId && !/^[a-zA-Z0-9_-]+$/.test(data.conversationId)) {
        throw new Error("Invalid conversationId");
      }
      if (data.note) data.note = data.note.slice(0, 140);
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const {
        data: { user },
      } = await context.supabase.auth.getUser();

      const prices = await stripe.prices.list({ lookup_keys: ["spark_plus_gift_month"] });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");

      const customerId = await resolveOrCreateCustomer(stripe, {
        ...(user?.email ? { email: user.email } : {}),
        userId: context.userId,
      });

      // One-time payment, not a subscription: the recipient gets one month
      // of Spark Plus credited directly by the webhook, with no recurring
      // Stripe subscription object tied to their account.
      const metadata: Record<string, string> = {
        userId: context.userId,
        recipientId: data.recipientId,
        managed_payments: "true",
        kind: "spark_plus_gift",
        ...(data.conversationId ? { conversationId: data.conversationId } : {}),
        ...(data.note ? { note: data.note } : {}),
      };

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata,
        payment_intent_data: { metadata },
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<InvoicesResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    try {
      const stripe = createStripeClient(data.environment);
      const { data: auth } = await supabase.auth.getUser();
      let customerId = sub?.stripe_customer_id ?? null;
      if (!customerId) {
        const found = await stripe.customers.search({
          query: `metadata['userId']:'${userId}'`,
          limit: 1,
        });
        customerId = found.data[0]?.id ?? null;
      }
      if (!customerId && auth.user?.email) {
        const found = await stripe.customers.list({ email: auth.user.email, limit: 1 });
        customerId = found.data[0]?.id ?? null;
      }
      if (!customerId) return { invoices: [], purchases: [], customer: false };

      const [invoices, sessions] = await Promise.all([
        stripe.invoices.list({ customer: customerId, limit: 36 }),
        stripe.checkout.sessions.list({
          customer: customerId,
          limit: 50,
          expand: ["data.line_items", "data.payment_intent.latest_charge"],
        }),
      ]);
      return {
        customer: true,
        invoices: invoices.data.map((inv) => ({
          id: inv.id ?? "",
          number: inv.number,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          created: inv.created,
          hostedInvoiceUrl: inv.hosted_invoice_url,
          invoicePdf: inv.invoice_pdf,
        })),
        purchases: sessions.data
          .filter((session) => session.payment_status !== "unpaid")
          .map((session) => {
            const paymentIntent =
              typeof session.payment_intent === "object" ? session.payment_intent : null;
            const charge =
              paymentIntent && typeof paymentIntent.latest_charge === "object"
                ? paymentIntent.latest_charge
                : null;
            return {
              id: session.id,
              label:
                session.line_items?.data
                  .map((item) => item.description)
                  .filter(Boolean)
                  .join(", ") ||
                (session.mode === "subscription" ? "Spark Plus" : "BloxSpark purchase"),
              amountTotal: session.amount_total ?? 0,
              currency: session.currency ?? "eur",
              paymentStatus: session.payment_status,
              status: session.status,
              mode: session.mode,
              created: session.created,
              receiptUrl: charge?.receipt_url ?? null,
            };
          }),
      };
    } catch (error) {
      return {
        invoices: [],
        purchases: [],
        customer: false,
        error: getStripeErrorMessage(error),
      };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return { error: "No subscription found" };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
