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

type Search = { mode?: "signup" | "signin" | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search =>
    search["mode"] === "signup" ? { mode: "signup" } : {},

  head: () => ({
    meta: [
      { title: "Connexion — Bloxspark" },
      {
        name: "description",
        content: "Connecte-toi ou crée ton compte Bloxspark pour rejoindre la communauté Roblox.",
      },
      { property: "og:title", content: "Connexion — Bloxspark" },
      { property: "og:description", content: "Rejoins Bloxspark en quelques secondes." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, setLang } = useI18n();
  const { setTheme } = useTheme();
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useSession();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/home", replace: true });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(t("checkEmail"));
        setIsSignup(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(t("errorGeneric"));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home" });
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

        <Button className="mt-6 w-full" variant="outline" onClick={google}>
          <span className="text-base">🇬</span> {t("continueGoogle")}
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("orEmail")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
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
