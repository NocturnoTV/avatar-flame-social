import { useEffect, useState } from "react";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { isNativeApp, openExternal } from "@/lib/native";
import { createDeviceLoginCode } from "@/lib/device-login.functions";

const SESSION_FLAG = "bloxspark-device-code-shown";

/**
 * Shows a one-time popup with a device-login code right after signing in on
 * the website - by email/password, Google, or Roblox (the Roblox OAuth
 * callback lands directly on an authenticated page, never back on /auth,
 * so hooking this into every individual sign-in path in auth.tsx would
 * miss it; mounting this once at the authenticated layout instead catches
 * all of them the same way). Lets someone jump into the app without ever
 * opening Settings. Native is skipped entirely - there is nothing to
 * bridge to when you're already in the app. Fires at most once per
 * browser tab session (sessionStorage flag), not on every navigation.
 */
export function DeviceCodePopup() {
  const { t } = useI18n();
  const { user } = useSession();
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!user || isNativeApp()) return;
    try {
      if (sessionStorage.getItem(SESSION_FLAG) === "1") return;
      sessionStorage.setItem(SESSION_FLAG, "1");
    } catch {
      return; // private browsing / storage disabled - just skip, not worth erroring over
    }
    void (async () => {
      try {
        const result = await createDeviceLoginCode();
        setCode({ code: result.code, expiresAt: Date.now() + result.expiresInSeconds * 1000 });
      } catch {
        // Silent - this is a convenience popup, not a required step.
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!code) return;
    const tick = () => {
      const left = Math.max(0, Math.round((code.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setCode(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [code]);

  if (!code) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={() => setCode(null)}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-bold">{t("signupCodeTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("signupCodeSubtitle")}</p>
        <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 py-4 font-mono text-3xl font-black tracking-widest">
          {code.code}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("signupCodeExpiresIn", { seconds: secondsLeft })}
        </p>
        <Button className="mt-4 w-full" onClick={() => void openExternal("bloxspark://open")}>
          {t("signupCodeOpenApp")}
        </Button>
        <button
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setCode(null)}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
