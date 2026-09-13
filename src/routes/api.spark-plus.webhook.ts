import { createFileRoute } from "@tanstack/react-router";

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validStripeSignature(payload: string, signature: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=", 2)));
  const timestamp = parts["t"];
  const expected = parts["v1"];
  if (!timestamp || !expected || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  return hex(digest) === expected;
}

export const Route = createFileRoute("/api/spark-plus/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        const stripeSecret = process.env["STRIPE_SECRET_KEY"];
        if (!webhookSecret || !stripeSecret) return new Response("Not configured", { status: 503 });
        const payload = await request.text();
        const signature = request.headers.get("stripe-signature") ?? "";
        if (!(await validStripeSignature(payload, signature, webhookSecret))) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(payload) as StripeEvent;
        if (
          event.type !== "checkout.session.completed" &&
          !event.type.startsWith("customer.subscription.")
        ) {
          return Response.json({ received: true });
        }
        const object = event.data.object;
        const subscriptionId = String(object["subscription"] ?? object["id"] ?? "");
        const userId = String(
          object["client_reference_id"] ??
            (object["metadata"] as Record<string, unknown> | undefined)?.["user_id"] ??
            "",
        );
        if (!subscriptionId || !userId) return Response.json({ received: true });

        const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { Authorization: `Bearer ${stripeSecret}` },
        });
        if (!response.ok) return new Response("Unable to read subscription", { status: 502 });
        const subscription = (await response.json()) as {
          id: string;
          customer: string;
          status: string;
          current_period_end?: number;
          metadata?: Record<string, string>;
        };
        const resolvedUserId = userId || subscription.metadata?.["user_id"] || "";
        const active = ["active", "trialing"].includes(subscription.status);
        const expiresAt = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("spark_plus_subscriptions").upsert(
          {
            user_id: resolvedUserId,
            provider: "stripe",
            provider_customer_id: subscription.customer,
            provider_subscription_id: subscription.id,
            status: subscription.status === "canceled" ? "cancelled" : subscription.status,
            current_period_end: expiresAt,
          },
          { onConflict: "user_id" },
        );
        await supabaseAdmin
          .from("profiles")
          .update({ spark_plus_active: active, spark_plus_expires_at: expiresAt })
          .eq("id", resolvedUserId);
        return Response.json({ received: true });
      },
    },
  },
});
