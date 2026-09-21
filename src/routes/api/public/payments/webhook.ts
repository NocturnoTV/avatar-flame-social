import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { type StripeEnv, createStripeClient, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient<any>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<any>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

function isoFromUnix(seconds?: number | null): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Posts a "thanks for your purchase" message from Team Spark. The body is
 * just a small marker (`purchase_thanks:<kind>:<amount>`) - like the
 * existing "safety_alert" marker - so the actual sentence is rendered
 * client-side in the viewer's current language rather than guessed here. */
async function sendPurchaseThanks(userId: string, kind: "blox" | "spark_plus", amount?: number) {
  await getSupabase()
    .from("notifications")
    .insert({
      user_id: userId,
      kind: "system",
      body: kind === "blox" ? `purchase_thanks:blox:${amount ?? 0}` : "purchase_thanks:spark_plus",
    });
}

/** Checkout metadata is supplied by the buyer, so a conversation id in it is
 * untrusted: only post the gift message when the payer really is a member of
 * that conversation. */
async function isConversationMember(conversationId: string, userId: string) {
  const { data } = await getSupabase()
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function syncProfile(userId: string, status: string, periodEnd: string | null) {
  const active =
    ["active", "trialing", "past_due"].includes(status) ||
    (status === "canceled" && !!periodEnd && new Date(periodEnd).getTime() > Date.now());
  await getSupabase()
    .from("profiles")
    .update({ spark_plus_active: active, spark_plus_expires_at: periodEnd })
    .eq("id", userId);
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const periodEndIso = isoFromUnix(periodEnd);

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        product_id: productId,
        price_id: priceId,
        status: subscription.status,
        current_period_start: isoFromUnix(periodStart),
        current_period_end: periodEndIso,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );

  await syncProfile(userId, subscription.status, periodEndIso);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  const userId = subscription.metadata?.userId;
  if (userId) await syncProfile(userId, "canceled", null);
}

/** Credits a completed one-time Blox pack purchase. Runs with the service
 * role, which the protect_blox_balance trigger explicitly allows alongside
 * the SECURITY DEFINER RPCs the client itself is limited to. */
async function handleBloxPackPurchase(session: Stripe.Checkout.Session) {
  const payerId = session.metadata?.["userId"];
  if (!payerId) {
    console.error("Blox pack checkout completed with no userId in metadata");
    return;
  }
  // A gift ("Cadeau" from a conversation, or "buy Blox for this person")
  // credits recipientId instead of the payer.
  const userId = session.metadata?.["recipientId"] || payerId;
  const sessionId = session.id as string;

  // Stripe can retry checkout.session.completed; make crediting idempotent
  // by keying the ledger row on the session id.
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("blox_transactions")
    .select("id")
    .eq("reference_id", sessionId)
    .eq("kind", "purchase")
    .maybeSingle();
  if (existing) return;

  const stripe = createStripeClient(session.livemode ? "live" : "sandbox");
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    expand: ["data.price"],
  });
  const price = lineItems.data[0]?.price;
  const bloxAmount = Number(price?.metadata?.["blox_amount"] ?? 0);
  if (!bloxAmount) {
    console.error("Blox pack checkout completed with no blox_amount on the price", sessionId);
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("blox_balance")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return;

  await supabase
    .from("profiles")
    .update({ blox_balance: profile.blox_balance + bloxAmount })
    .eq("id", userId);
  await supabase.from("blox_transactions").insert({
    user_id: userId,
    amount: bloxAmount,
    kind: "purchase",
    reference_id: sessionId,
    description:
      userId === payerId
        ? `Achat de pack Blox (${price?.lookup_key ?? "inconnu"})`
        : `Pack Blox offert (${price?.lookup_key ?? "inconnu"})`,
  });

  // Gifted from a DM ("buy Blox for this person"): post a "gift" message
  // into that conversation so both sides see it there, not just a silent
  // balance change.
  const conversationId = session.metadata?.["conversationId"];
  const note = session.metadata?.["note"];
  if (conversationId && userId !== payerId && (await isConversationMember(conversationId, payerId))) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: payerId,
      kind: "gift",
      content: JSON.stringify({ type: "blox", amount: bloxAmount, ...(note ? { note } : {}) }),
    });
  }

  // Team Spark thanks the payer for the purchase, whether it was for
  // themselves or a gift for someone else.
  await sendPurchaseThanks(payerId, "blox", bloxAmount);
}

/** Credits one gifted month of Spark Plus directly to the recipient. This is
 * a one-time payment, not a Stripe subscription - there is no recurring
 * object tied to the recipient's account, only the profile flags. */
async function handleSparkPlusGift(session: Stripe.Checkout.Session) {
  const recipientId = session.metadata?.["recipientId"];
  if (!recipientId) {
    console.error("Spark Plus gift checkout completed with no recipientId in metadata");
    return;
  }
  const sessionId = session.id as string;

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("blox_transactions")
    .select("id")
    .eq("reference_id", sessionId)
    .eq("kind", "purchase")
    .maybeSingle();
  if (existing) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("spark_plus_active,spark_plus_expires_at")
    .eq("id", recipientId)
    .maybeSingle();
  if (!profile) return;

  // Stack onto an existing active period instead of overwriting it.
  const base =
    profile.spark_plus_active && profile.spark_plus_expires_at
      ? new Date(profile.spark_plus_expires_at)
      : new Date();
  const expires = new Date(Math.max(base.getTime(), Date.now()));
  expires.setDate(expires.getDate() + 30);

  await supabase
    .from("profiles")
    .update({ spark_plus_active: true, spark_plus_expires_at: expires.toISOString() })
    .eq("id", recipientId);

  // Reuses the Blox ledger as a general "purchases" log entry (amount 0)
  // so gifted Spark Plus still shows up in Purchases & Billing history.
  await supabase.from("blox_transactions").insert({
    user_id: recipientId,
    amount: 0,
    kind: "purchase",
    reference_id: sessionId,
    description: "1 mois de Spark Plus offert",
  });

  // Same as the Blox pack gift above: surface it as a message in the DM
  // it was sent from, when there is one.
  const conversationId = session.metadata?.["conversationId"];
  const payerId = session.metadata?.["userId"];
  const note = session.metadata?.["note"];
  if (payerId) await sendPurchaseThanks(payerId, "spark_plus");
  if (conversationId && payerId) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: payerId,
      kind: "gift",
      content: JSON.stringify({ type: "spark_plus", ...(note ? { note } : {}) }),
    });
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.["kind"] === "blox_pack") {
        await handleBloxPackPurchase(session);
      } else if (session.mode === "payment" && session.metadata?.["kind"] === "spark_plus_gift") {
        await handleSparkPlusGift(session);
      } else if (session.mode === "subscription" && session.metadata?.["userId"]) {
        // Self Spark Plus subscription purchase (not a gift) - the
        // subscription's own status is synced separately via
        // customer.subscription.created/updated, this only sends the
        // Team Spark thank-you.
        await sendPurchaseThanks(session.metadata["userId"], "spark_plus");
      }
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
