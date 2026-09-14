import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { Button, Input, Label } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { signInWithIdentifier } from "@/lib/login-identifier.functions";
import { errorMessage } from "@/lib/utils";

type Search = { mode?: "signup" | "signin" | undefined; addAccount?: boolean };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
    ...(search["addAccount"] === true || search["addAccount"] === "true" ? { addAccount: true } : {}),
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
  const { setTheme } = useTheme();
  const { mode, addAccount } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useSession();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
          await continueAfterAuthentication();
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

  async function google() {
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
        <h1 className="text-2xl font-bold">{isSignup ? t("signUp") : t("signIn")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>

        <Button className="mt-6 w-full" variant="outline" onClick={google} disabled={busy}>
          <span className="text-base">🇬</span> {t("continueGoogle")}
        </Button>

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
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
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
