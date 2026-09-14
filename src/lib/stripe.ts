import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Stripe payments are not configured for this build. Complete Stripe go-live in your Lovable project to enable production checkout.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

/** Same as getStripeEnvironment(), but returns null instead of throwing.
 * Use this anywhere the result feeds a query key or otherwise runs
 * unconditionally during render (e.g. shop/billing.tsx) - a raw
 * getStripeEnvironment() there would crash the whole page the moment Stripe
 * isn't configured, instead of just disabling the Stripe-dependent parts. */
export function getStripeEnvironmentSafe(): StripeEnv | null {
  try {
    return paymentsEnvironment();
  } catch {
    return null;
  }
}
