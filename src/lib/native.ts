import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * BloxSpark's iOS/Android apps are a thin Capacitor WebView shell that loads
 * the real, live bloxspark.app (see capacitor.config.ts) - there is no
 * separate "mobile app" codebase to keep in sync. This file is the only
 * place that should ever check `Capacitor.isNativePlatform()` directly;
 * everything else imports the helpers below so the native-vs-web branching
 * logic stays in one spot.
 */

/** True only inside the compiled iOS/Android app, never in a normal browser
 * tab or the installed PWA - safe to call during SSR (returns false, since
 * there's no native bridge on the server). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function nativePlatform(): "ios" | "android" | "web" {
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}

/**
 * Opens a URL outside the app's own WebView. Native: the system browser
 * (Safari/Chrome) via @capacitor/browser - required for anything the
 * WebView itself shouldn't/can't host, e.g. Roblox's OAuth screen (some
 * identity providers refuse to render inside an embedded WebView) or a
 * Stripe Customer Portal session. Web: the normal new-tab window.open.
 */
export async function openExternal(url: string) {
  if (isNativeApp()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Real-money purchases (Blox packs, Spark Plus, gifting either) stay on the
 * website instead of an embedded Stripe checkout inside the native app, at
 * the user's request - simplest way to stay clear of Apple's/Google's
 * in-app-purchase requirement for digital goods without building out native
 * StoreKit/Play Billing + server-side receipt validation. `path` is a
 * bloxspark.app path such as "/shop" or "/shop/billing".
 */
export async function openWebPurchase(path: string) {
  const base = isNativeApp() ? "https://bloxspark.app" : window.location.origin;
  await openExternal(`${base}${path}`);
}

/**
 * Drop-in guard for the top of any embedded Stripe checkout component:
 * fires the website redirect once on mount when running in the native app,
 * and tells the caller whether to render its normal embedded checkout (false)
 * or a <NativePurchaseNotice /> instead (true). No-op on the web.
 */
export function useNativeCheckoutGate(path: string): boolean {
  const native = isNativeApp();
  useEffect(() => {
    if (native) void openWebPurchase(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return native;
}
