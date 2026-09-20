import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { Button, Input, Label } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { signInWithIdentifier } from "@/lib/login-identifier.functions";
import { requestPasswordReset } from "@/lib/password-reset.functions";
import { beginRobloxSignIn } from "@/lib/roblox-oauth.functions";
import { createDeviceLoginCode, redeemDeviceLoginCode } from "@/lib/device-login.functions";
import { isNativeApp, openExternal } from "@/lib/native";
import { errorMessage } from "@/lib/utils";

type Search = {
  mode?: "signup" | "signin" | undefined;
  addAccount?: boolean;
  /** Set when this /auth load was opened by the native app's "Continue with
   * Google/Roblox" button via the system browser (see google()/roblox()
   * below) - auto-starts that provider's flow instead of waiting for
   * another click, since the person already expressed that intent once. */
  provider?: "google" | "roblox";
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
    ...(search["addAccount"] === true || search["addAccount"] === "true"
      ? { addAccount: true }
      : {}),
    ...(search["provider"] === "google" || search["provider"] === "roblox"
      ? { provider: search["provider"] }
      : {}),
  }),

  head: () => ({
    meta: [
      { title: "Sign in - BloxSpark" },
      {
        name: "description",
        content: "Sign in or create your BloxSpark account to join the Roblox community.",
      },
      { property: "og:title", content: "Sign in - BloxSpark" },
      { property: "og:description", content: "Join BloxSpark in a few seconds." },
      { property: "og:url", content: "https://bloxspark.app/auth" },
      // A bare sign-in form has no unique content worth ranking on its own -
      // keep it out of search results so people land on "/" instead.
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { mode, addAccount, provider } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useSession();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [robloxBusy, setRobloxBusy] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [deviceCodeInput, setDeviceCodeInput] = useState("");
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [codeCooldownUntil, setCodeCooldownUntil] = useState(0);
  const [codeCooldownLeft, setCodeCooldownLeft] = useState(0);
  const [signupCode, setSignupCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [signupCodeSecondsLeft, setSignupCodeSecondsLeft] = useState(0);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);

  // Clicking the link in a password-reset email lands back here with a
  // recovery session already established - Supabase fires this event once
  // it picks that up, and it's the signal to switch to "set a new
  // password" instead of the normal sign-in form.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotIdentifier.trim() || forgotSending) return;
    setForgotSending(true);
    try {
      await requestPasswordReset({ data: { identifier: forgotIdentifier.trim() } });
      setForgotSent(true);
    } catch {
      // Always show the same generic success state - never reveal whether
      // an account matched the identifier.
      setForgotSent(true);
    } finally {
      setForgotSending(false);
    }
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6 || recoverySaving) return;
    setRecoverySaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("passwordUpdated"));
      setRecoveryMode(false);
      await continueAfterAuthentication();
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setRecoverySaving(false);
    }
  }

  async function continueAfterAuthentication() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    const completed = profile?.onboarding_completed === true;
    await supabase.auth.updateUser({
      data: { onboarding_completed: completed, onboarding_required: !completed },
    });
    navigate({
      to: completed ? "/home" : "/onboarding",
      replace: true,
    });
  }

  useEffect(() => {
    // In "add account" mode we're deliberately signed in under the account being
    // replaced - skip the passive redirect so the sign-in form stays visible.
    if (session?.user.id && !addAccount) void continueAfterAuthentication();
  }, [session?.user.id, addAccount]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { onboarding_completed: false, onboarding_required: true },
          },
        });
        if (error) throw error;
        if (data.session?.user.id) {
          // On the website (not the app itself), offer a code to jump
          // straight into the app instead of continuing here - most useful
          // right when an account is brand new. Skipped entirely on
          // native: signing up there means the account already lives in
          // the app, there is nothing to bridge.
          if (isNativeApp()) {
            await continueAfterAuthentication();
            return;
          }
          try {
            const result = await createDeviceLoginCode();
            setSignupCode({
              code: result.code,
              expiresAt: Date.now() + result.expiresInSeconds * 1000,
            });
            // Showing our own code screen right here already - tell
            // <DeviceCodePopup/> (mounted once you land in the app) not to
            // pop up a second one for this same sign-in.
            try {
              sessionStorage.setItem("bloxspark-device-code-shown", "1");
            } catch {
              // ignore
            }
          } catch {
            await continueAfterAuthentication();
          }
          return;
        }
        toast.success(t("checkEmail"));
        setIsSignup(false);
      } else {
        const tokens = await signInWithIdentifier({ data: { identifier, password } });
        const { error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (error) throw error;
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("invalid_credentials");
        await continueAfterAuthentication();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message.includes("invalid_credentials") ? t("badLogin") : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  // Google actively refuses to render its sign-in page inside an embedded
  // app WebView ("disallowed_useragent") - Roblox has shown the same
  // behaviour in testing. Both providers work fine in a real browser, so on
  // native we send the person to the website (system browser, not this
  // WebView) to finish signing in there, then drop straight into the
  // "enter a code" screen after a few seconds so they have something to do
  // with the code the website shows them, instead of staring at a dead end
  // in the app.
  function continueOnWebsite(withProvider: "google" | "roblox") {
    void openExternal(`https://bloxspark.app/auth?provider=${withProvider}`);
    setTimeout(() => setCodeMode(true), 5000);
  }

  async function google() {
    if (isNativeApp()) {
      continueOnWebsite("google");
      return;
    }
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (!result.error) {
        if (result.redirected) return;
        const { data } = await supabase.auth.getUser();
        if (data.user) await continueAfterAuthentication();
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
    } finally {
      setBusy(false);
    }
  }

  async function roblox() {
    if (isNativeApp()) {
      continueOnWebsite("roblox");
      return;
    }
    setRobloxBusy(true);
    try {
      const result = await beginRobloxSignIn();
      window.location.assign(result.url);
    } catch (error) {
      console.error("Roblox sign-in start failed", error);
      toast.error(t("robloxConnectUnavailable"));
      setRobloxBusy(false);
    }
  }

  // Auto-start when this load came from the native app's "continue on
  // website" redirect above (?provider=...) - the person already chose a
  // provider once in the app, no need to make them click again here too.
  useEffect(() => {
    if (provider === "google") void google();
    else if (provider === "roblox") void roblox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // "Se connecter avec un code": redeems a short code generated from
  // Settings on an already-signed-in device/browser - see
  // src/lib/device-login.functions.ts. verifyOtp applies the resulting
  // token locally, no redirect needed, so this is the fastest way into the
  // account on a fresh device (typically a just-installed native app).
  useEffect(() => {
    if (!signupCode) return;
    const tick = () => {
      const left = Math.max(0, Math.round((signupCode.expiresAt - Date.now()) / 1000));
      setSignupCodeSecondsLeft(left);
      if (left === 0) setSignupCode(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [signupCode]);

  // Local mirror of the server's per-IP throttle (3 attempts / rolling 3s
  // window, see redeemDeviceLoginCode) so the button visibly cools down
  // instead of just silently failing again on the very next click.
  useEffect(() => {
    if (!codeCooldownUntil) return;
    const tick = () => setCodeCooldownLeft(Math.max(0, codeCooldownUntil - Date.now()));
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [codeCooldownUntil]);

  async function redeemCode() {
    const code = deviceCodeInput.trim();
    if (!code || codeCooldownLeft > 0) return;
    setRedeemingCode(true);
    try {
      const result = await redeemDeviceLoginCode({ data: { code } });
      const { error } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: "magiclink",
      });
      if (error) throw error;
      await continueAfterAuthentication();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("rate_limited")) {
        setCodeCooldownUntil(Date.now() + 3000);
        toast.error(t("deviceCodeRateLimited"));
      } else {
        toast.error(t("deviceCodeInvalid"));
      }
    } finally {
      setRedeemingCode(false);
    }
  }

  function continueAsGuest() {
    window.localStorage.setItem("bloxspark-guest", "true");
    window.localStorage.removeItem("bloxspark-guest-gate-seen");
    setLang("en");
    setTheme("dark");
    navigate({ to: "/guest" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <Link to="/" className="mb-10">
        <Logo className="h-24 drop-shadow-[0_0_40px_rgba(255,90,140,0.25)] sm:h-28" />
      </Link>

      <div className="w-full max-w-sm rounded-[2rem] border border-border bg-card p-7 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]">
        <h1 className="text-2xl font-bold">
          {recoveryMode
            ? t("resetPasswordTitle")
            : forgotMode
              ? t("forgotPasswordTitle")
              : signupCode
                ? t("signupCodeTitle")
                : codeMode
                  ? t("deviceCodeTitle")
                  : isSignup
                    ? t("signUp")
                    : t("signIn")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {recoveryMode
            ? t("resetPasswordSubtitle")
            : forgotMode
              ? t("forgotPasswordSubtitle")
              : signupCode
                ? t("signupCodeSubtitle")
                : codeMode
                  ? t("deviceCodeSubtitle")
                  : t("tagline")}
        </p>

        {recoveryMode ? (
          <form onSubmit={saveNewPassword} className="mt-6 space-y-4">
            <div>
              <Label>{t("newPasswordLabel")}</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={recoverySaving}>
              {recoverySaving ? t("loading") : t("resetPasswordSubmit")}
            </Button>
          </form>
        ) : forgotMode ? (
          <div className="mt-6 space-y-4">
            {forgotSent ? (
              <p className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center text-sm">
                {t("forgotPasswordSent")}
              </p>
            ) : (
              <form onSubmit={sendPasswordReset} className="space-y-4">
                <div>
                  <Label>{t("identifierLabel")}</Label>
                  <Input
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder={t("identifierPlaceholder")}
                  />
                </div>
                <Button className="w-full" size="lg" type="submit" disabled={forgotSending}>
                  {forgotSending ? t("loading") : t("forgotPasswordSubmit")}
                </Button>
              </form>
            )}
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setForgotMode(false);
                setForgotSent(false);
                setForgotIdentifier("");
              }}
            >
              {t("backToSignIn")}
            </button>
          </div>
        ) : signupCode ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="font-mono text-2xl font-black tracking-widest">{signupCode.code}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("signupCodeExpiresIn", { seconds: signupCodeSecondsLeft })}
              </p>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => void openExternal("bloxspark://open")}
            >
              {t("signupCodeOpenApp")}
            </Button>
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSignupCode(null);
                void continueAfterAuthentication();
              }}
            >
              {t("signupCodeContinueWeb")}
            </button>
          </div>
        ) : codeMode ? (
          <div className="mt-6 space-y-4">
            <div>
              <Label>{t("deviceCodeLabel")}</Label>
              <Input
                value={deviceCodeInput}
                onChange={(e) => setDeviceCodeInput(e.target.value.toUpperCase())}
                placeholder="123-4567"
                maxLength={8}
                autoFocus
                className="text-center font-mono text-lg tracking-widest"
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={redeemingCode || !deviceCodeInput.trim() || codeCooldownLeft > 0}
              onClick={() => void redeemCode()}
            >
              {redeemingCode
                ? "…"
                : codeCooldownLeft > 0
                  ? t("deviceCodeCooldown", { seconds: Math.ceil(codeCooldownLeft / 1000) })
                  : t("deviceCodeSubmit")}
            </Button>
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setCodeMode(false)}
            >
              {t("deviceCodeBack")}
            </button>
          </div>
        ) : (
          <>
            <Button className="mt-6 w-full" variant="outline" onClick={google} disabled={busy}>
              <span className="text-base">🇬</span> {t("continueGoogle")}
            </Button>
            <Button
              className="mt-3 w-full"
              variant="outline"
              onClick={roblox}
              disabled={busy || robloxBusy}
            >
              <img
                src={theme === "dark" ? "/roblox-logo-white.png" : "/roblox-logo-black.png"}
                alt=""
                aria-hidden="true"
                className="h-5 w-5 object-contain"
              />
              {robloxBusy ? t("robloxRedirecting") : t("continueRoblox")}
            </Button>
            <button
              className="mt-3 w-full text-center text-sm text-primary hover:underline"
              onClick={() => setCodeMode(true)}
            >
              {t("deviceCodeToggle")}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("orEmail")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              {isSignup ? (
                <div>
                  <Label>{t("email")}</Label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="toi@exemple.com"
                  />
                </div>
              ) : (
                <div>
                  <Label>{t("identifierLabel")}</Label>
                  <Input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={t("identifierPlaceholder")}
                  />
                </div>
              )}
              <div>
                <Label>{t("password")}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
                {!isSignup ? (
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="mt-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {t("forgotPasswordLink")}
                  </button>
                ) : null}
              </div>
              <Button className="w-full" size="lg" type="submit" disabled={busy}>
                {isSignup ? t("signUp") : t("signIn")}
              </Button>
            </form>

            <button
              className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setIsSignup((v) => !v)}
            >
              {isSignup ? t("haveAccount") : t("noAccount")}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("or")}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button className="w-full" variant="ghost" onClick={continueAsGuest}>
              {t("continueAsGuest")}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">{t("guestAccessHint")}</p>
          </>
        )}
      </div>

      <p className="mt-8 max-w-sm text-center text-xs text-muted-foreground">
        {t("notAffiliated")}{" "}
        <Link to="/terms" className="underline">
          {t("terms")}
        </Link>{" "}
        ·{" "}
        <Link to="/privacy" className="underline">
          {t("privacy")}
        </Link>
      </p>
    </div>
  );
}
