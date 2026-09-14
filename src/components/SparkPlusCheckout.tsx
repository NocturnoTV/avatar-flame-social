import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSparkPlusCheckout } from "@/utils/payments.functions";

export function SparkPlusCheckout({ returnUrl }: { returnUrl?: string }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createSparkPlusCheckout({
      data: {
        priceId: "spark_plus_monthly",
        returnUrl: returnUrl || `${window.location.origin}/shop?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="mt-6 overflow-hidden rounded-3xl bg-white p-2">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
