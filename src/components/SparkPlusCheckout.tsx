import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSparkPlusCheckout } from "@/utils/payments.functions";
import { useNativeCheckoutGate } from "@/lib/native";
import { NativePurchaseNotice } from "@/components/NativePurchaseNotice";

export function SparkPlusCheckout({ returnUrl }: { returnUrl?: string }) {
  const native = useNativeCheckoutGate("/shop/billing");
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

  if (native) return <NativePurchaseNotice />;

  return (
    <div id="checkout" className="mt-6 overflow-hidden rounded-3xl bg-white p-2">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
