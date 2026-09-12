import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button, Input, Label, Select, Textarea } from "@/components/ui-kit";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { ageFrom } from "@/lib/decorations";
import { Flag } from "@/components/Flag";
import heroAsset from "@/assets/onboarding-hero.png.asset.json";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inscription — Bloxspark" },
      {
        name: "description",
        content: "Renseigne ton pseudo, ton compte Roblox, ta langue et ta date de naissance.",
      },
      { property: "og:title", content: "Inscription — Bloxspark" },
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

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [roblox, setRoblox] = useState("");
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

  const age = ageFrom(birth);
  const minor = age !== null && age < 18;
  const tooYoung = age !== null && age < 13;

  async function finish() {
    if (!user) return;
    if (!username.trim() || !roblox.trim() || !birth) {
      toast.error(t("required"));
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
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        roblox_username: roblox.trim(),
        language: lang,
        birth_date: birth,
        bio: bio.trim(),
        theme,
        parental_consent: minor ? parentOk : true,
        parent_name: minor ? parentName.trim() : null,
        parent_email: minor ? parentEmail.trim() : null,
        onboarding_completed: true,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? t("usernameTaken") : error.message);
      return;
    }
    navigate({ to: "/sparks", replace: true });
  }

  const steps = [t("username"), t("birthDate"), t("profile") || "Profil"];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-5 pb-14 pt-6">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/25 blur-3xl bx-glow" />
      <div className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 rounded-full bg-spark-2/25 blur-3xl bx-glow" />

      <div className="relative mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-[2rem] border border-border shadow-[0_30px_70px_-40px_rgba(0,0,0,0.7)]">
          <div className="relative">
            <img
              src={heroAsset.url}
              alt="Avatars Roblox colorés en pleine action"
              className="h-40 w-full object-cover sm:h-48"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <Logo className="absolute bottom-4 left-1/2 h-16 -translate-x-1/2 bx-float drop-shadow-[0_0_36px_rgba(0,0,0,0.5)] sm:h-20" />
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
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="sparky" />
              </div>
              <div>
                <Label>{t("robloxUsername")}</Label>
                <Input value={roblox} onChange={(e) => setRoblox(e.target.value)} placeholder="Builderman" />
              </div>
              <div>
                <Label>{t("language")}</Label>
                <Select value={lang} onChange={(e) => setLang(e.target.value as LangCode)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep(1)}>
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
