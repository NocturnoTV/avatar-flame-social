import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { redeemDeviceLoginLink } from "@/lib/device-login.functions";
import { isNativeApp, openExternal } from "@/lib/native";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";

/**
 * Landing page for a persistent device-login link (generated once from
 * Settings, see generateDeviceLoginLink) - signs this browser/app in
 * immediately using the token in the URL. On the web, also offers to hand
 * off to the native app (which has its own copy of this same redemption
 * logic in NativeAppBridge's appUrlOpen listener) since someone clicking
 * this link from, say, a notes app or a password manager is more likely
 * reaching for the app than the browser.
 */
export const Route = createFileRoute("/link/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: DeviceLoginLinkPage,
});

function DeviceLoginLinkPage() {
  const { t } = useI18n();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { tokenHash } = await redeemDeviceLoginLink({ data: { token } });
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });
        if (otpError) throw otpError;
        if (cancelled) return;
        setState("done");
        if (!isNativeApp()) {
          setTimeout(() => {
            void openExternal(`bloxspark://link?token=${encodeURIComponent(token)}`);
          }, 600);
        }
        setTimeout(() => void navigate({ to: "/home" }), isNativeApp() ? 0 : 1200);
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, t("errorGeneric")));
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="h-10 w-auto" />
      {state === "working" ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : state === "done" ? (
        <>
          <p className="text-sm font-bold text-primary">{t("signInLinkSuccess")}</p>
          {!isNativeApp() ? (
            <Button onClick={() => void openExternal(`bloxspark://link?token=${encodeURIComponent(token)}`)}>
              {t("signupCodeOpenApp")}
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void navigate({ to: "/auth" })}>
            {t("backToSignIn")}
          </Button>
        </>
      )}
    </div>
  );
}
