import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";
import { useTheme } from "@/lib/theme";

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
