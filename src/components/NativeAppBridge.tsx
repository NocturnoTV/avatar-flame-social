import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { isNativeApp, nativePlatform, openExternal } from "@/lib/native";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { redeemDeviceLoginLink, redeemDeviceLoginCode } from "@/lib/device-login.functions";
import { Button } from "@/components/ui-kit";

/** "1.2.10" > "1.2.9" numerically, not lexicographically. */
function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * Everything the iOS/Android shell needs that a normal browser tab doesn't:
 * hide the native splash screen once React has mounted, theme the status
 * bar to match the app's own dark/light theme, and make the Android
 * hardware back button behave like a back button instead of instantly
 * killing the app. No-ops entirely on the web (isNativeApp() is false), so
 * this is safe to always render.
 */
export function NativeAppBridge() {
  const { theme } = useTheme();
  const { user } = useSession();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [updatePrompt, setUpdatePrompt] = useState<{ storeUrl: string; version: string } | null>(
    null,
  );

  // Checks once per app launch whether a newer build has been published -
  // app_releases is a small table we update ourselves whenever a new native
  // build actually goes live, since there's no public API to poll the
  // Play/App Store listing directly.
  useEffect(() => {
    if (!isNativeApp()) return;
    void (async () => {
      try {
        const [{ App }, { data: release }] = await Promise.all([
          import("@capacitor/app"),
          supabase
            .from("app_releases")
            .select("latest_version,store_url")
            .eq("platform", nativePlatform())
            .maybeSingle(),
        ]);
        if (!release) return;
        const info = await App.getInfo();
        if (isNewerVersion(release.latest_version, info.version)) {
          setUpdatePrompt({ storeUrl: release.store_url, version: release.latest_version });
        }
      } catch {
        // No update prompt is better than a broken one.
      }
    })();
  }, []);

  // Catches the app being (re)opened via the custom bloxspark:// scheme
  // carrying either a persistent device-login-link token (see /link/$token,
  // which does the same redemption when opened in a browser - reinstalling
  // the app, or signing in with no other device around) or a one-time
  // device code (see DeviceCodePopup.tsx and auth.tsx's
  // continueAfterAuthentication, fired right after signing in on the
  // website so the app logs in automatically instead of asking someone to
  // copy a code over by hand).
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        let params: URLSearchParams;
        try {
          params = new URL(url).searchParams;
        } catch {
          return;
        }
        const token = params.get("token");
        const code = params.get("code");
        if (!token && !code) return;
        void (async () => {
          try {
            const { tokenHash } = token
              ? await redeemDeviceLoginLink({ data: { token } })
              : await redeemDeviceLoginCode({ data: { code: code! } });
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: "magiclink",
            });
            if (error) throw error;
            void navigate({ to: "/home" });
          } catch {
            // Already signed in, or an invalid/expired/regenerated
            // token/code - nothing useful to show for a deep link that
            // fired in the background.
          }
        })();
      });
      remove = () => void handle.remove();
    })();
    return () => remove?.();
  }, [navigate]);

  // Registers this device for real OS-level push notifications (Firebase
  // Cloud Messaging under the hood) once someone is signed in - the token
  // Firebase hands back is meaningless without knowing which account it
  // belongs to, so there's nothing useful to register while logged out.
  // Re-runs (and re-upserts) on every sign-in, since Android can rotate the
  // token and a fresh install always gets a new one.
  useEffect(() => {
    if (!isNativeApp() || !user) return;
    let removeRegistration: (() => void) | undefined;
    let removeError: (() => void) | undefined;
    void (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const permission = await PushNotifications.checkPermissions();
      let granted = permission.receive === "granted";
      if (permission.receive === "prompt") {
        const requested = await PushNotifications.requestPermissions();
        granted = requested.receive === "granted";
      }
      if (!granted) return;

      const registrationHandle = await PushNotifications.addListener(
        "registration",
        (token) => {
          void supabase.from("push_device_tokens").upsert(
            {
              token: token.value,
              user_id: user.id,
              platform: nativePlatform(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "token" },
          );
        },
      );
      removeRegistration = () => void registrationHandle.remove();

      const errorHandle = await PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration failed", err);
      });
      removeError = () => void errorHandle.remove();

      await PushNotifications.register();
    })();
    return () => {
      removeRegistration?.();
      removeError?.();
    };
  }, [user]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    void (async () => {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      if (!cancelled) await SplashScreen.hide();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    void (async () => {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      // App background is dark by default (#08090d) with an opt-in light
      // theme (#faf7fe) - status bar icon color is the inverse of that.
      await StatusBar.setStyle({ style: theme === "dark" ? Style.Light : Style.Dark });
      await StatusBar.setBackgroundColor({ color: theme === "dark" ? "#08090d" : "#faf7fe" });
    })();
  }, [theme]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.minimizeApp();
      });
      remove = () => void handle.remove();
    })();
    return () => remove?.();
  }, []);

  if (!updatePrompt) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
          <Download className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-black">{t("updateAvailableTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("updateAvailableBody", { version: updatePrompt.version })}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            onClick={() => {
              void openExternal(updatePrompt.storeUrl);
            }}
          >
            {t("updateNow")}
          </Button>
          <button
            onClick={() => setUpdatePrompt(null)}
            className="py-2 text-sm font-semibold text-muted-foreground"
          >
            {t("updateLater")}
          </button>
        </div>
      </div>
    </div>
  );
}
