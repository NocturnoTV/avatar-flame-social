import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBloxPackCheckout } from "@/utils/payments.functions";

/** Embedded Stripe Checkout for a single Blox pack, one-time payment.
 * `allow_promotion_codes` is set server-side, so Stripe's own hosted UI
 * already shows a "code promo" field - no custom promo logic needed here. */
export function BloxPackCheckout({
  lookupKey,
  recipientId,
  conversationId,
  onClose,
}: {
  lookupKey: string;
  /** Credit someone else's balance instead of the payer's - "buy Blox for
   * this person" from the Cadeau sheet. */
  recipientId?: string;
  /** Posts a "gift" message into this DM once the webhook confirms payment. */
  conversationId?: string;
  onClose?: () => void;
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createBloxPackCheckout({
      data: {
        lookupKey,
        ...(recipientId ? { recipientId } : {}),
        ...(conversationId ? { conversationId } : {}),
        returnUrl: `${window.location.origin}/shop?blox_session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div className="mt-4 overflow-hidden rounded-3xl bg-white p-2">
      {onClose ? (
        <button
          onClick={onClose}
          className="ml-1 mt-1 text-xs font-bold text-neutral-500 hover:text-neutral-800"
        >
          ← Retour
        </button>
      ) : null}
      <EmbeddedCheckoutProvider
        key={lookupKey}
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
