import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Crown,
  Database,
  Download,
  Eye,
  Lock,
  Palette,
  Receipt,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createDeviceLoginCode } from "@/lib/device-login.functions";
import { Button, Input, Label, Select, Sheet } from "@/components/ui-kit";
import { LANGUAGES, robloxOAuthErrorKey, useI18n, type LangCode } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { useRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/native";
import { RobloxConnection } from "@/components/RobloxConnection";
import { getStripeEnvironmentSafe } from "@/lib/stripe";
import { createPortalSession } from "@/utils/payments.functions";
import { SparkPlusCheckout } from "@/components/SparkPlusCheckout";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } =>
    typeof search["session_id"] === "string" ? { session_id: search["session_id"] } : {},
  head: () => ({
    meta: [
      { title: "Settings - Bloxspark" },
      {
        name: "description",
        content: "Manage your Bloxspark account, notifications, privacy and security.",
      },
      { property: "og:title", content: "Settings - Bloxspark" },
      { property: "og:description", content: "Manage your Bloxspark account." },
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
  /** Likes, favorites, reposts and mentions on your videos - the rest of
   * the "Activités" thread that isn't a comment. */
  activity: boolean;
  announcements: boolean;
  paused: boolean;
};

type PrivacyPrefs = {
  discoverable: boolean;
  show_age: boolean;
  show_activity: boolean;
  messages_from: string;
};

// NOTE: "followers" has no matching entry yet - there is no "someone
// followed you" notification kind in the database at all (following a
// profile is currently silent everywhere), so this toggle is kept for a
// future follow-notification feature but doesn't gate anything today.
const NOTIF_LABELS: { key: keyof NotifPrefs; labelKey: string; hintKey: string }[] = [
  { key: "matches", labelKey: "notifPrefMatches", hintKey: "notifPrefMatchesHint" },
  { key: "likes", labelKey: "notifPrefLikes", hintKey: "notifPrefLikesHint" },
  { key: "messages", labelKey: "notifPrefMessages", hintKey: "notifPrefMessagesHint" },
  { key: "followers", labelKey: "notifPrefFollowers", hintKey: "notifPrefFollowersHint" },
  { key: "comments", labelKey: "notifPrefComments", hintKey: "notifPrefCommentsHint" },
  { key: "activity", labelKey: "notifPrefActivity", hintKey: "notifPrefActivityHint" },
  {
    key: "announcements",
    labelKey: "notifPrefAnnouncements",
    hintKey: "notifPrefAnnouncementsHint",
  },
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
  const { session_id: newSubscriptionSessionId } = Route.useSearch();
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [deviceCode, setDeviceCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [deviceCodeSecondsLeft, setDeviceCodeSecondsLeft] = useState(0);

  // getStripeEnvironmentSafe() returns null instead of throwing when Stripe
  // isn't configured for this build - see src/lib/stripe.ts.
  const stripeEnv = getStripeEnvironmentSafe();
  const paymentsConfigured = stripeEnv !== null;

  const membership = useQuery({
    queryKey: ["settings-spark-plus-membership", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spark_plus_active,spark_plus_expires_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const subscription = useQuery({
    queryKey: ["settings-billing-subscription", user?.id, stripeEnv],
    enabled: !!user && paymentsConfigured,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status,cancel_at_period_end")
        .eq("user_id", user!.id)
        .eq("environment", stripeEnv!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const planExpiration = membership.data?.spark_plus_expires_at;
  const planActive = Boolean(
    membership.data?.spark_plus_active &&
    (!planExpiration || new Date(planExpiration).getTime() > Date.now()),
  );

  // Landed back here after subscribing to Spark Plus from this page.
  useEffect(() => {
    if (!newSubscriptionSessionId) return;
    toast.success(t("purchaseThankYouSparkPlusBody"));
    void navigate({ to: "/settings", search: {}, replace: true });
    void membership.refetch();
  }, [newSubscriptionSessionId, navigate, t, membership]);

  async function manageSubscription() {
    if (!paymentsConfigured) return;
    try {
      const result = await createPortalSession({
        data: { returnUrl: window.location.href, environment: stripeEnv! },
      });
      if ("error" in result) throw new Error(result.error);
      void openExternal(result.url);
    } catch {
      toast.error(t("sparkPlusCheckoutUnavailable"));
    }
  }

  const profile = useQuery({
    queryKey: ["settings-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "username,roblox_username,roblox_user_id,roblox_display_name,roblox_avatar_url,roblox_connected_at,roblox_synced_at,username_changed_at,language,theme,deletion_requested_at,verified,show_online_status,dnd",
        )
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (data?.username) setUsername(data.username);
      return data;
    },
    enabled: !!user,
  });

  const prefsQuery = useQuery({
    queryKey: ["settings-prefs"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_private")
        .select("notification_prefs,privacy_prefs")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      return data;
    },
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

  const notif = (prefsQuery.data?.notification_prefs ?? {}) as Partial<NotifPrefs>;
  const privacy = (prefsQuery.data?.privacy_prefs ?? {}) as Partial<PrivacyPrefs>;

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
      toast.error(t("passwordMinError"));
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
    toast.success(t("passwordUpdated"));
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
      a.download = `bloxspark-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await supabase
        .from("data_requests")
        .insert({ user_id: user.id, kind: "export", status: "completed" });
      void requests.refetch();
      toast.success(t("exportDownloaded"));
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    if (!user) return;
    if (!confirm(t("deletionConfirm"))) return;
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
    toast.success(t("deletionRequestSaved"));
  }

  async function cancelDeletion() {
    if (!pendingDeletion) return;
    await supabase
      .from("data_requests")
      .update({ status: "cancelled" })
      .eq("id", pendingDeletion.id);
    await patch({ deletion_requested_at: null });
    void requests.refetch();
    toast.success(t("deletionRequestCancelled"));
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/", replace: true });
  }

  // "Connecter un autre appareil": mint a short code here (already signed
  // in) that the /auth screen on another device/app redeems instantly via
  // redeemDeviceLoginCode - see src/lib/device-login.functions.ts.
  useEffect(() => {
    if (!deviceCode) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deviceCode.expiresAt - Date.now()) / 1000));
      setDeviceCodeSecondsLeft(left);
      if (left === 0) setDeviceCode(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deviceCode]);

  async function generateDeviceCode() {
    setGeneratingCode(true);
    try {
      const result = await createDeviceLoginCode();
      setDeviceCode({ code: result.code, expiresAt: Date.now() + result.expiresInSeconds * 1000 });
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setGeneratingCode(false);
    }
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
          <p className="font-semibold text-destructive">{t("deletionScheduled")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("deletionScheduledText", {
              date: pendingDeletion.scheduled_for
                ? new Date(pendingDeletion.scheduled_for).toLocaleDateString(lang)
                : "-",
            })}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={cancelDeletion}>
            {t("cancelRequest")}
          </Button>
        </div>
      ) : null}

      {isStaff ? (
        <Link
          to="/admin"
          className="mt-4 flex items-center gap-2 rounded-3xl border border-primary/40 bg-primary/5 p-4 text-sm font-semibold"
        >
          <ShieldCheck className="h-5 w-5 text-primary" /> {t("adminArea")}
        </Link>
      ) : null}

      <Section
        icon={UserCog}
        title={t("settingsAccountTitle")}
        description={t("settingsAccountDesc")}
      >
        <div>
          <Label>{t("username")}</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            {daysLeft > 0
              ? `${t("usernameCooldown")} (${t("daysCount", { count: daysLeft })})`
              : t("usernameChangeInfo")}
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
          <Label>{t("emailAddress")}</Label>
          <Input value={user?.email ?? ""} readOnly className="opacity-70" />
        </div>
        <div>
          <Label>{t("changePassword")}</Label>
          <Input
            type="password"
            placeholder={t("currentPassword")}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder={t("newPasswordHint")}
            className="mt-2"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Button size="sm" className="mt-2" onClick={changePassword} disabled={!newPassword}>
            {t("updatePassword")}
          </Button>
        </div>
      </Section>

      <Section
        icon={Crown}
        title={t("purchasesAndBilling")}
        description={t("settingsSubscriptionDesc")}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Crown className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{planActive ? "Spark Plus" : t("billingNoSubscription")}</p>
            {planActive ? (
              <p className="text-xs text-muted-foreground">
                {subscription.data?.cancel_at_period_end
                  ? t("endsAtPeriod")
                  : planExpiration
                    ? t("renewsOn", { date: new Date(planExpiration).toLocaleDateString(lang) })
                    : t("sparkPlusActive")}
              </p>
            ) : null}
          </div>
        </div>
        {planActive ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={!paymentsConfigured}
            onClick={() => void manageSubscription()}
          >
            {t("manageSubscription")}
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={!paymentsConfigured}
            onClick={() => setSubscribing(true)}
          >
            <Crown className="h-4 w-4" /> {t("subscribeSparkPlus")}
          </Button>
        )}
        <Link
          to="/shop/billing"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-bold hover:border-primary/40"
        >
          <Receipt className="h-4 w-4" /> {t("purchasesAndBilling")}
        </Link>
      </Section>

      <Section icon={Palette} title={t("appearanceTitle")} description={t("appearanceDesc")}>
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

      <Section icon={Bell} title={t("notifications")} description={t("notificationSettingsDesc")}>
        <Toggle
          label={t("pauseAllNotifications")}
          hint={t("pauseAllHint")}
          checked={notif.paused === true}
          onChange={(v) => setNotif("paused", v)}
        />
        <div className={cn("space-y-4", notif.paused ? "pointer-events-none opacity-40" : "")}>
          {NOTIF_LABELS.map((n) => (
            <Toggle
              key={n.key}
              label={t(n.labelKey)}
              hint={t(n.hintKey)}
              checked={notif[n.key] !== false}
              onChange={(v) => setNotif(n.key, v)}
            />
          ))}
        </div>
      </Section>

      <Section icon={Eye} title={t("privacyTitle")} description={t("privacyDesc")}>
        <Toggle
          label={t("appearOnline")}
          hint={t("appearOnlineHint")}
          checked={profile.data?.show_online_status !== false}
          onChange={(v) => void patch({ show_online_status: v })}
        />
        <Toggle
          label={t("doNotDisturb")}
          hint={t("doNotDisturbHint")}
          checked={profile.data?.dnd === true}
          onChange={(v) => void patch({ dnd: v })}
        />
        <Toggle
          label={t("appearInSparks")}
          hint={t("appearInSparksHint")}
          checked={privacy.discoverable !== false}
          onChange={(v) => setPrivacy("discoverable", v)}
        />
        <Toggle
          label={t("showMyAge")}
          checked={privacy.show_age !== false}
          onChange={(v) => setPrivacy("show_age", v)}
        />
        <Toggle
          label={t("showMyActivity")}
          checked={privacy.show_activity !== false}
          onChange={(v) => setPrivacy("show_activity", v)}
        />
        <div>
          <Label>{t("whoCanMessage")}</Label>
          <Select
            value={privacy.messages_from ?? "matches"}
            onChange={(e) => setPrivacy("messages_from", e.target.value)}
          >
            <option value="matches">{t("messagesMatchesOnly")}</option>
            <option value="everyone">{t("messagesEveryone")}</option>
            <option value="nobody">{t("messagesNobody")}</option>
          </Select>
        </div>
      </Section>

      <Section icon={Lock} title={t("securityTitle")} description={t("securityDesc")}>
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
          {t("signOutAllDevices")}
        </Button>
      </Section>

      <Section icon={Smartphone} title={t("deviceLoginTitle")} description={t("deviceLoginDesc")}>
        {deviceCode ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="font-mono text-2xl font-black tracking-widest">{deviceCode.code}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("deviceLoginExpiresIn", { seconds: deviceCodeSecondsLeft })}
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            disabled={generatingCode}
            onClick={() => void generateDeviceCode()}
          >
            <Smartphone className="h-4 w-4" />
            {generatingCode ? "…" : t("deviceLoginGenerate")}
          </Button>
        )}
      </Section>

      <Section icon={Database} title={t("myDataTitle")} description={t("myDataDesc")}>
        <p className="text-sm text-muted-foreground">{t("dataRightsText")}</p>
        <Button variant="outline" className="w-full" onClick={downloadData} disabled={exporting}>
          <Download className="h-4 w-4" /> {exporting ? t("preparingExport") : t("downloadAllData")}
        </Button>
        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={requestDeletion}
          disabled={!!pendingDeletion}
        >
          <Trash2 className="h-4 w-4" /> {t("requestDataDeletion")}
        </Button>
        {(requests.data ?? []).length > 0 ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {(requests.data ?? []).slice(0, 5).map((r) => (
              <p key={r.id}>
                {r.kind === "export" ? t("requestExport") : t("requestDeletion")} ·{" "}
                {t(`requestStatus${r.status[0]?.toUpperCase()}${r.status.slice(1)}`)} ·{" "}
                {new Date(r.created_at).toLocaleDateString(lang)}
              </p>
            ))}
          </div>
        ) : null}
      </Section>

      <Section icon={ShieldCheck} title={t("aboutTitle")}>
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

      {subscribing ? (
        <Sheet open onClose={() => setSubscribing(false)} title={t("subscribeSparkPlus")}>
          <button
            onClick={() => setSubscribing(false)}
            aria-label={t("cancel")}
            className="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> {t("cancel")}
          </button>
          <SparkPlusCheckout
            returnUrl={`${window.location.origin}/settings?session_id={CHECKOUT_SESSION_ID}`}
          />
        </Sheet>
      ) : null}
    </div>
  );
}
