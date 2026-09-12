import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Database,
  Download,
  Eye,
  Lock,
  Palette,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Select } from "@/components/ui-kit";
import { LANGUAGES, robloxOAuthErrorKey, useI18n, type LangCode } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { useRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { RobloxConnection } from "@/components/RobloxConnection";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — Bloxspark" },
      {
        name: "description",
        content: "Compte, notifications, confidentialité, sécurité et gestion de tes données.",
      },
      { property: "og:title", content: "Paramètres — Bloxspark" },
      { property: "og:description", content: "Gère ton compte Bloxspark." },
    ],
  }),
  component: SettingsPage,
});

const DAY = 24 * 60 * 60 * 1000;

type NotifPrefs = {
  matches: boolean;
  likes: boolean;
  messages: boolean;
  followers: boolean;
  comments: boolean;
  announcements: boolean;
  paused: boolean;
};

type PrivacyPrefs = {
  discoverable: boolean;
  show_age: boolean;
  show_activity: boolean;
  messages_from: string;
};

const NOTIF_LABELS: { key: keyof NotifPrefs; label: string; hint: string }[] = [
  { key: "matches", label: "Nouveaux matchs", hint: "Quand un Spark est réciproque" },
  { key: "likes", label: "J'aime et Super Sparks", hint: "Quand quelqu'un t'aime" },
  { key: "messages", label: "Messages", hint: "Messages privés et de groupe" },
  { key: "followers", label: "Nouveaux abonnés", hint: "Sur tes vidéos Découvrir" },
  { key: "comments", label: "Commentaires", hint: "Réactions sur tes vidéos" },
  { key: "announcements", label: "Annonces Bloxspark", hint: "Nouveautés et sécurité" },
];

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-bold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
      role="switch"
      aria-checked={checked}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "spark-gradient" : "bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[1.4rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user } = useSession();
  const { isStaff } = useRoles();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [exporting, setExporting] = useState(false);

  const profile = useQuery({
    queryKey: ["settings-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "username,roblox_username,roblox_user_id,roblox_display_name,roblox_avatar_url,roblox_connected_at,roblox_synced_at,username_changed_at,language,theme,notification_prefs,privacy_prefs,deletion_requested_at,verified",
        )
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (data?.username) setUsername(data.username);
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("roblox") === "connected") toast.success(t("robloxConnected"));
    if (params.has("roblox_error")) toast.error(t(robloxOAuthErrorKey(params.get("roblox_error"))));
  }, [t]);

  const requests = useQuery({
    queryKey: ["data-requests"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("data_requests")
        .select("id,kind,status,scheduled_for,created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const blocked = useQuery({
    queryKey: ["blocked"],
    queryFn: async () => {
      const { data } = await supabase.from("blocks").select("blocked_id");
      const ids = (data ?? []).map((b) => b.blocked_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username")
        .in("id", ids);
      return profiles ?? [];
    },
    enabled: !!user,
  });

  const notif = (profile.data?.notification_prefs ?? {}) as Partial<NotifPrefs>;
  const privacy = (profile.data?.privacy_prefs ?? {}) as Partial<PrivacyPrefs>;

  const changedAt = profile.data?.username_changed_at
    ? new Date(profile.data.username_changed_at).getTime()
    : 0;
  const daysLeft = Math.max(0, Math.ceil((changedAt + 7 * DAY - Date.now()) / DAY));
  const pendingDeletion = requests.data?.find(
    (r) => r.kind === "deletion" && r.status === "pending",
  );

  async function patch(values: Record<string, unknown>) {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update(values as never)
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void profile.refetch();
  }

  function setNotif(key: keyof NotifPrefs, value: boolean) {
    void patch({ notification_prefs: { ...notif, [key]: value } });
  }
  function setPrivacy(key: keyof PrivacyPrefs, value: boolean | string) {
    void patch({ privacy_prefs: { ...privacy, [key]: value } });
  }

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

  async function changePassword() {
    if (newPassword.length < 8) {
      toast.error("8 caractères minimum.");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    setCurrentPassword("");
    toast.success("Mot de passe mis à jour.");
  }

  async function downloadData() {
    if (!user) return;
    setExporting(true);
    try {
      const [p, photos, games, matches, messages, swipes, videos, notifications, reports, blocks] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("profile_photos").select("*").eq("user_id", user.id),
          supabase.from("roblox_games").select("*").eq("user_id", user.id),
          supabase.from("matches").select("*"),
          supabase.from("messages").select("*").eq("sender_id", user.id),
          supabase.from("swipes").select("*").eq("swiper_id", user.id),
          supabase.from("videos").select("*").eq("user_id", user.id),
          supabase.from("notifications").select("*").eq("user_id", user.id),
          supabase.from("reports").select("*").eq("reporter_id", user.id),
          supabase.from("blocks").select("*").eq("blocker_id", user.id),
        ]);
      const payload = {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, created_at: user.created_at },
        profile: p.data,
        photos: photos.data,
        favorite_games: games.data,
        matches: matches.data,
        messages: messages.data,
        swipes: swipes.data,
        videos: videos.data,
        notifications: notifications.data,
        reports: reports.data,
        blocks: blocks.data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bloxspark-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await supabase
        .from("data_requests")
        .insert({ user_id: user.id, kind: "export", status: "completed" });
      void requests.refetch();
      toast.success("Export téléchargé.");
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    if (!user) return;
    if (
      !confirm("Demander la suppression définitive de ton compte et de tes données dans 30 jours ?")
    )
      return;
    const scheduled = new Date(Date.now() + 30 * DAY).toISOString();
    const { error } = await supabase
      .from("data_requests")
      .insert({ user_id: user.id, kind: "deletion", status: "pending", scheduled_for: scheduled });
    if (error) {
      toast.error(error.message);
      return;
    }
    await patch({ deletion_requested_at: new Date().toISOString() });
    void requests.refetch();
    toast.success("Demande enregistrée. Tu peux l'annuler pendant 30 jours.");
  }

  async function cancelDeletion() {
    if (!pendingDeletion) return;
    await supabase
      .from("data_requests")
      .update({ status: "cancelled" })
      .eq("id", pendingDeletion.id);
    await patch({ deletion_requested_at: null });
    void requests.refetch();
    toast.success("Demande annulée.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/", replace: true });
  }

  async function deleteNow() {
    if (!user) return;
    if (!confirm(t("deleteAccountConfirm"))) return;
    await supabase.from("roblox_games").delete().eq("user_id", user.id);
    await supabase.from("profile_photos").delete().eq("user_id", user.id);
    await supabase
      .from("profiles")
      .update({
        username: null,
        bio: "",
        roblox_username: null,
        avatar_url: null,
        banner_url: null,
        onboarding_completed: false,
      })
      .eq("id", user.id);
    await supabase.auth.signOut();
    toast.success(t("accountDeleted"));
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-10">
      <header className="flex items-center gap-3">
        <Link to="/profile" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
      </header>

      {pendingDeletion ? (
        <div className="mt-4 rounded-3xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Suppression programmée</p>
          <p className="mt-1 text-muted-foreground">
            Tes données seront effacées le{" "}
            {pendingDeletion.scheduled_for
              ? new Date(pendingDeletion.scheduled_for).toLocaleDateString("fr-FR")
              : "—"}
            . Tu peux annuler à tout moment d'ici là.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={cancelDeletion}>
            Annuler la demande
          </Button>
        </div>
      ) : null}

      {isStaff ? (
        <Link
          to="/admin"
          className="mt-4 flex items-center gap-2 rounded-3xl border border-primary/40 bg-primary/5 p-4 text-sm font-semibold"
        >
          <ShieldCheck className="h-5 w-5 text-primary" /> Espace administration
        </Link>
      ) : null}

      <Section icon={UserCog} title="Compte" description="Identité et accès">
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
        <RobloxConnection
          profile={profile.data}
          returnTo="/settings"
          manage
          onChanged={() => void profile.refetch()}
        />
        <div>
          <Label>Adresse e-mail</Label>
          <Input value={user?.email ?? ""} readOnly className="opacity-70" />
        </div>
        <div>
          <Label>Changer de mot de passe</Label>
          <Input
            type="password"
            placeholder="Mot de passe actuel"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder="Nouveau mot de passe (8 caractères min.)"
            className="mt-2"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Button size="sm" className="mt-2" onClick={changePassword} disabled={!newPassword}>
            Mettre à jour
          </Button>
        </div>
      </Section>

      <Section icon={Palette} title="Apparence" description="Thème et langue">
        <div>
          <Label>{t("theme")}</Label>
          <div className="flex gap-3">
            {(["dark", "light"] as const).map((option) => (
              <button
                key={option}
                onClick={async () => {
                  setTheme(option);
                  if (user)
                    await supabase.from("profiles").update({ theme: option }).eq("id", user.id);
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
              if (user)
                await supabase.from("profiles").update({ language: value }).eq("id", user.id);
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section icon={Bell} title="Notifications" description="Choisis ce qui te fait vibrer">
        <Toggle
          label="Mettre toutes les notifications en pause"
          hint="Rien ne te sera envoyé tant que c'est activé"
          checked={notif.paused === true}
          onChange={(v) => setNotif("paused", v)}
        />
        <div className={cn("space-y-4", notif.paused ? "pointer-events-none opacity-40" : "")}>
          {NOTIF_LABELS.map((n) => (
            <Toggle
              key={n.key}
              label={n.label}
              hint={n.hint}
              checked={notif[n.key] !== false}
              onChange={(v) => setNotif(n.key, v)}
            />
          ))}
        </div>
      </Section>

      <Section icon={Eye} title="Confidentialité" description="Qui voit quoi">
        <Toggle
          label="Apparaître dans les Sparks"
          hint="Désactive pour ne plus être proposé au swipe"
          checked={privacy.discoverable !== false}
          onChange={(v) => setPrivacy("discoverable", v)}
        />
        <Toggle
          label="Afficher mon âge"
          checked={privacy.show_age !== false}
          onChange={(v) => setPrivacy("show_age", v)}
        />
        <Toggle
          label="Afficher ma dernière activité"
          checked={privacy.show_activity !== false}
          onChange={(v) => setPrivacy("show_activity", v)}
        />
        <div>
          <Label>Qui peut m'écrire</Label>
          <Select
            value={privacy.messages_from ?? "matches"}
            onChange={(e) => setPrivacy("messages_from", e.target.value)}
          >
            <option value="matches">Uniquement mes matchs</option>
            <option value="everyone">Tout le monde</option>
            <option value="nobody">Personne</option>
          </Select>
        </div>
      </Section>

      <Section icon={Lock} title="Sécurité" description="Blocages et sessions">
        <div>
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
        </div>
        <Button variant="outline" className="w-full" onClick={signOutEverywhere}>
          Déconnecter tous mes appareils
        </Button>
      </Section>

      <Section
        icon={Database}
        title="Mes données"
        description="RGPD (UE), UK GDPR, CCPA et lois équivalentes"
      >
        <p className="text-sm text-muted-foreground">
          Tu disposes d'un droit d'accès, de rectification, d'effacement, de portabilité, de
          limitation et d'opposition sur tes données. Les demandes sont traitées sous 30 jours
          maximum.
        </p>
        <Button variant="outline" className="w-full" onClick={downloadData} disabled={exporting}>
          <Download className="h-4 w-4" />{" "}
          {exporting ? "Préparation…" : "Télécharger toutes mes données (JSON)"}
        </Button>
        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={requestDeletion}
          disabled={!!pendingDeletion}
        >
          <Trash2 className="h-4 w-4" /> Demander la suppression de mes données
        </Button>
        {(requests.data ?? []).length > 0 ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {(requests.data ?? []).slice(0, 5).map((r) => (
              <p key={r.id}>
                {r.kind === "export" ? "Export" : "Suppression"} · {r.status} ·{" "}
                {new Date(r.created_at).toLocaleDateString("fr-FR")}
              </p>
            ))}
          </div>
        ) : null}
      </Section>

      <Section icon={ShieldCheck} title="À propos">
        <div className="space-y-2 text-sm">
          <Link to="/terms" className="block py-1.5">
            {t("terms")}
          </Link>
          <Link to="/privacy" className="block py-1.5">
            {t("privacy")}
          </Link>
          <Link to="/community-guidelines" className="block py-1.5">
            {t("communityRules")}
          </Link>
          <p className="pt-2 text-xs text-muted-foreground">Bloxspark · version 1.0</p>
        </div>
      </Section>

      <Button variant="outline" className="mt-5 w-full" onClick={signOut}>
        {t("signOut")}
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-destructive" onClick={deleteNow}>
        {t("deleteAccount")}
      </Button>

      <p className="mt-8 text-center text-xs text-muted-foreground">{t("notAffiliated")}</p>
    </div>
  );
}
