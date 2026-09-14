import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoWordmark } from "@/components/Logo";
import { Button, Input, Label, Textarea } from "@/components/ui-kit";
import { LANGUAGES, robloxOAuthErrorKey, useI18n, type LangCode } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { ageFrom } from "@/lib/decorations";
import { Flag } from "@/components/Flag";
import heroAsset from "@/assets/onboarding-hero.png.asset.json";
import { RobloxConnection } from "@/components/RobloxConnection";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inscription - Bloxspark" },
      {
        name: "description",
        content: "Renseigne ton pseudo, ton compte Roblox, ta langue et ta date de naissance.",
      },
      { property: "og:title", content: "Inscription - Bloxspark" },
      { property: "og:description", content: "Crée ton profil Bloxspark en trois étapes." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const [intro, setIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [birth, setBirth] = useState("");
  const [bio, setBio] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentOk, setParentOk] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("roblox") === "connected") toast.success(t("robloxConnected"));
    if (params.has("roblox_error")) toast.error(t(robloxOAuthErrorKey(params.get("roblox_error"))));
  }, [t]);

  const robloxProfile = useQuery({
    queryKey: ["onboarding-roblox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "roblox_user_id,roblox_username,roblox_display_name,roblox_avatar_url,roblox_synced_at",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const robloxUsername = robloxProfile.data?.roblox_username;
    if (robloxUsername && !username.trim()) setUsername(robloxUsername);
  }, [robloxProfile.data?.roblox_username]);

  const age = ageFrom(birth);
  // Parental consent is required for 13-14 year-olds; 15+ doesn't need it.
  const minor = age !== null && age < 15;
  const tooYoung = age !== null && age < 13;

  async function finish() {
    if (!user) return;
    if (!username.trim() || !birth) {
      toast.error(t("required"));
      return;
    }
    if (!robloxProfile.data?.roblox_user_id) {
      toast.error("Connecte ton compte Roblox pour continuer.");
      return;
    }
    if (tooYoung) {
      toast.error(t("tooYoung"));
      return;
    }
    if (minor && (!parentOk || !parentName.trim() || !parentEmail.trim())) {
      toast.error(t("parentalText"));
      return;
    }
    if (!terms) {
      toast.error(t("acceptTerms"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      username: username.trim(),
      language: lang,
      birth_date: birth,
      bio: bio.trim(),
      theme,
      parental_consent: minor ? parentOk : true,
      parent_name: minor ? parentName.trim() : null,
      parent_email: minor ? parentEmail.trim() : null,
      onboarding_completed: true,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? t("usernameTaken") : error.message);
      return;
    }
    const { error: markerError } = await supabase.auth.updateUser({
      data: { onboarding_completed: true, onboarding_required: false },
    });
    if (markerError) {
      toast.error(markerError.message);
      return;
    }
    navigate({ to: "/home", replace: true });
  }

  const steps = [t("username"), t("birthDate"), t("profile")];

  if (intro) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background px-5 pb-12 pt-6">
        <div className="pointer-events-none absolute -left-32 -top-10 h-80 w-80 rounded-full bg-primary/30 blur-3xl bx-glow" />
        <div className="pointer-events-none absolute -right-28 top-1/3 h-80 w-80 rounded-full bg-spark-2/30 blur-3xl bx-glow bx-delay-2" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl bx-glow bx-delay-4" />

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="bx-rise overflow-hidden rounded-[2.2rem] border border-border shadow-[0_40px_90px_-45px_rgba(0,0,0,0.85)]">
            <div className="relative">
              <img
                src={heroAsset.url}
                alt="Avatars Roblox colorés en pleine action"
                className="h-56 w-full object-cover sm:h-64"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute inset-0 bx-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <LogoWordmark className="absolute bottom-4 left-1/2 h-24 -translate-x-1/2 bx-float drop-shadow-[0_0_48px_rgba(0,0,0,0.6)] sm:h-28" />
            </div>
          </div>

          <h1 className="bx-rise bx-delay-1 mt-8 text-center text-4xl font-black leading-tight">
            Bienvenue sur <span className="spark-text">Bloxspark</span>
          </h1>
          <p className="bx-rise bx-delay-2 mx-auto mt-3 max-w-sm text-center text-sm text-muted-foreground">
            Rencontre des joueurs Roblox, partage tes vidéos et fais briller ton profil. Trois
            petites étapes et c'est parti.
          </p>

          <div className="mt-7 grid gap-3">
            {[
              { icon: "✨", title: "Sparks", text: "Swipe et matche avec des joueurs comme toi" },
              {
                icon: "🎬",
                title: "Découvrir",
                text: "Des vidéos Roblox en boucle, à toi de briller",
              },
              { icon: "💬", title: "Messages", text: "Groupes, vocaux et émojis avec tes matchs" },
            ].map((f, i) => (
              <div
                key={f.title}
                className={`bx-pop flex items-center gap-3 rounded-3xl border border-border bg-card/80 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary bx-delay-${i + 2}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl spark-gradient text-xl">
                  {f.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-bold">{f.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{f.text}</p>
                </div>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="bx-pop bx-delay-4 mt-8 w-full text-base"
            onClick={() => setIntro(false)}
          >
            {t("continue")}
          </Button>
          <Link
            to="/auth"
            className="bx-pop bx-delay-4 mt-3 block rounded-2xl border border-border bg-card/70 py-3 text-center text-sm font-semibold backdrop-blur transition hover:border-primary"
          >
            {t("haveAccount")} <span className="spark-text">{t("signIn")}</span>
          </Link>
          <p className="mt-5 text-center text-xs text-muted-foreground">{t("notAffiliated")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-5 pb-14 pt-6">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/25 blur-3xl bx-glow" />
      <div className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 rounded-full bg-spark-2/25 blur-3xl bx-glow" />

      <div className="relative mx-auto w-full max-w-md">
        <div className="bx-rise overflow-hidden rounded-[2rem] border border-border shadow-[0_30px_70px_-40px_rgba(0,0,0,0.7)]">
          <div className="relative">
            <img
              src={heroAsset.url}
              alt="Avatars Roblox colorés en pleine action"
              className="h-40 w-full object-cover sm:h-48"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bx-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <LogoWordmark className="absolute bottom-4 left-1/2 h-20 -translate-x-1/2 bx-float drop-shadow-[0_0_36px_rgba(0,0,0,0.5)] sm:h-24" />
          </div>
        </div>

        <h1 className="mt-7 text-center text-3xl font-bold">
          <span className="spark-text">{t("onboarding")}</span>
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {steps[step]} · {step + 1}/3
        </p>

        <div className="mt-5 flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? "spark-gradient" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div
          key={step}
          className="bx-rise mt-6 space-y-5 rounded-[2rem] border border-border bg-card p-6 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.6)]"
        >
          {step === 0 && (
            <>
              <div>
                <Label>{t("username")}</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="sparky"
                />
              </div>
              <RobloxConnection
                profile={robloxProfile.data}
                returnTo="/onboarding"
                onChanged={() => void robloxProfile.refetch()}
              />
              <div>
                <Label>{t("language")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLang(l.code as LangCode)}
                      className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                        lang === l.code
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Flag code={l.code} />
                      <span className="truncate">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={!robloxProfile.data?.roblox_user_id}
                onClick={() => setStep(1)}
              >
                {t("continue")}
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <Label>{t("birthDate")}</Label>
                <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
                {tooYoung ? <p className="mt-2 text-sm text-destructive">{t("tooYoung")}</p> : null}
              </div>
              {minor && !tooYoung ? (
                <div className="space-y-4 rounded-2xl border border-border p-4">
                  <p className="text-sm font-semibold">{t("parentalTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("parentalText")}</p>
                  <Input
                    placeholder={t("parentName")}
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                  />
                  <Input
                    type="email"
                    placeholder={t("parentEmail")}
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                  />
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[var(--spark)]"
                      checked={parentOk}
                      onChange={(e) => setParentOk(e.target.checked)}
                    />
                    {t("parentalCheck")}
                  </label>
                </div>
              ) : null}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                  {t("back")}
                </Button>
                <Button className="flex-1" disabled={!birth || tooYoung} onClick={() => setStep(2)}>
                  {t("continue")}
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>{t("bio")}</Label>
                <Textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={300}
                  placeholder="Bloxfruits, Adopt Me, obby pro..."
                />
              </div>
              <div>
                <Label>{t("theme")}</Label>
                <div className="flex gap-3">
                  {(["dark", "light"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setTheme(option)}
                      className={`flex-1 rounded-2xl border p-4 text-sm font-semibold ${
                        theme === option ? "border-primary ring-2 ring-primary/30" : "border-border"
                      }`}
                    >
                      <span
                        className={`mb-2 block h-10 rounded-xl ${
                          option === "dark" ? "bg-black" : "border border-border bg-white"
                        }`}
                      />
                      {option === "dark" ? t("dark") : t("light")}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--spark)]"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                {t("acceptTerms")}
              </label>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  {t("back")}
                </Button>
                <Button className="flex-1" disabled={busy} onClick={finish}>
                  {t("finish")}
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">{t("notAffiliated")}</p>
      </div>
    </div>
  );
}
