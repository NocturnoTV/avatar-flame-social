import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Select } from "@/components/ui-kit";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — Bloxspark" },
      { name: "description", content: "Thème, langue, pseudo, blocages et confidentialité de ton compte." },
      { property: "og:title", content: "Paramètres — Bloxspark" },
      { property: "og:description", content: "Gère ton compte Bloxspark." },
    ],
  }),
  component: SettingsPage,
});

const DAY = 24 * 60 * 60 * 1000;

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");

  const profile = useQuery({
    queryKey: ["settings-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,username_changed_at,language,theme")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (data?.username) setUsername(data.username);
      return data;
    },
    enabled: !!user,
  });

  const blocked = useQuery({
    queryKey: ["blocked"],
    queryFn: async () => {
      const { data } = await supabase.from("blocks").select("blocked_id");
      const ids = (data ?? []).map((b) => b.blocked_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", ids);
      return profiles ?? [];
    },
    enabled: !!user,
  });

  const changedAt = profile.data?.username_changed_at
    ? new Date(profile.data.username_changed_at).getTime()
    : 0;
  const daysLeft = Math.max(0, Math.ceil((changedAt + 7 * DAY - Date.now()) / DAY));

  async function saveUsername() {
    if (!user || !username.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .update({ username: username.trim() })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message.includes("duplicate") ? t("usernameTaken") : t("usernameCooldown"));
      return;
    }
    toast.success(t("saved"));
    void profile.refetch();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function deleteAccount() {
    if (!user) return;
    if (!confirm(t("deleteAccountConfirm"))) return;
    await supabase.from("profile_photos").delete().eq("user_id", user.id);
    await supabase
      .from("profiles")
      .update({ username: null, bio: "", roblox_username: null, onboarding_completed: false })
      .eq("id", user.id);
    await supabase.auth.signOut();
    toast.success(t("accountDeleted"));
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/profil" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
      </header>

      <section className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-4">
        <div>
          <Label>{t("username")}</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            {daysLeft > 0 ? `${t("usernameCooldown")} (${daysLeft} j)` : t("usernameChangeInfo")}
          </p>
          <Button size="sm" className="mt-2" onClick={saveUsername} disabled={daysLeft > 0}>
            {t("save")}
          </Button>
        </div>

        <div>
          <Label>{t("theme")}</Label>
          <div className="flex gap-3">
            {(["dark", "light"] as const).map((option) => (
              <button
                key={option}
                onClick={async () => {
                  setTheme(option);
                  if (user) await supabase.from("profiles").update({ theme: option }).eq("id", user.id);
                }}
                className={`flex-1 rounded-2xl border p-3 text-sm font-semibold ${
                  theme === option ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                {option === "dark" ? `🌙 ${t("dark")}` : `☀️ ${t("light")}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>{t("language")}</Label>
          <Select
            value={lang}
            onChange={async (e) => {
              const value = e.target.value as LangCode;
              setLang(value);
              if (user) await supabase.from("profiles").update({ language: value }).eq("id", user.id);
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-border bg-card p-4">
        <Label>{t("blockedUsers")}</Label>
        {(blocked.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noBlocked")}</p>
        ) : (
          <div className="space-y-2">
            {(blocked.data ?? []).map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span>{b.username}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await supabase.from("blocks").delete().eq("blocked_id", b.id);
                    void blocked.refetch();
                  }}
                >
                  {t("unblock")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 space-y-2 rounded-3xl border border-border bg-card p-4 text-sm">
        <Link to="/conditions" className="block py-1.5">
          {t("terms")}
        </Link>
        <Link to="/confidentialite" className="block py-1.5">
          {t("privacy")}
        </Link>
        <Link to="/regles" className="block py-1.5">
          {t("communityRules")}
        </Link>
      </section>

      <Button variant="outline" className="mt-5 w-full" onClick={signOut}>
        {t("signOut")}
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-destructive" onClick={deleteAccount}>
        {t("deleteAccount")}
      </Button>

      <p className="mt-8 text-center text-xs text-muted-foreground">{t("notAffiliated")}</p>
    </div>
  );
}
