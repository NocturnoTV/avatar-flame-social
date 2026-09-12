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

  return (
    <div className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <Logo className="mx-auto h-8" />
        <h1 className="mt-8 text-2xl font-bold">{t("onboarding")}</h1>
        <div className="mt-4 flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "spark-gradient" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-5">
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
