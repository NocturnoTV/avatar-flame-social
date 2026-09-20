import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { isNativeApp, nativePlatform } from "@/lib/native";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { redeemDeviceLoginLink } from "@/lib/device-login.functions";

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
  const navigate = useNavigate();

  // Catches the app being (re)opened via the custom bloxspark:// scheme
  // with a device-login-link token attached (see /link/$token, which does
  // the same redemption when opened in a browser instead) - lets someone
  // sign back into the app itself after reinstalling or logging out,
  // without needing another already-signed-in device to type a code from.
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        let token: string | null = null;
        try {
          token = new URL(url).searchParams.get("token");
        } catch {
          return;
        }
        if (!token) return;
        void (async () => {
          try {
            const { tokenHash } = await redeemDeviceLoginLink({ data: { token } });
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: "magiclink",
            });
            if (error) throw error;
            void navigate({ to: "/home" });
          } catch {
            // Already signed in, or an invalid/regenerated link - nothing
            // useful to show for a deep link that fired in the background.
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

  return null;
}
