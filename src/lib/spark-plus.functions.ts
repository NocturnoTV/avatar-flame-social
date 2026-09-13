import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createSparkPlusCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const secretKey = process.env["STRIPE_SECRET_KEY"];
    const priceId = process.env["STRIPE_SPARK_PLUS_PRICE_ID"];
    const siteUrl = process.env["SITE_URL"] ?? "https://bloxspark.app";
    if (!secretKey || !priceId) throw new Error("Spark Plus checkout is not configured");

    const { data } = await context.supabase.auth.getUser();
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: context.userId,
      "metadata[user_id]": context.userId,
      "subscription_data[metadata][user_id]": context.userId,
      success_url: `${siteUrl}/shop?spark_plus=success`,
      cancel_url: `${siteUrl}/shop?spark_plus=cancelled`,
      allow_promotion_codes: "true",
    });
    if (data.user?.email) body.set("customer_email", data.user.email);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const session = (await response.json()) as { url?: string; error?: { message?: string } };
    if (!response.ok || !session.url) {
      throw new Error(session.error?.message ?? "Unable to create checkout");
    }
    return { url: session.url };
  });
