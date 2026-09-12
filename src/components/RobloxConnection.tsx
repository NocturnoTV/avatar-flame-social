import { CheckCircle2, Gamepad2, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import {
  beginRobloxOAuth,
  disconnectRobloxAccount,
  syncRobloxAccount,
} from "@/lib/roblox-oauth.functions";

export type RobloxConnectionProfile = {
  roblox_user_id: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_synced_at?: string | null;
};

function RobloxLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M7.2 2 30 7.2 24.8 30 2 24.8 7.2 2Zm6.6 10.1-1.9 8.1 8.2 1.9 1.9-8.2-8.2-1.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function RobloxConnection({
  profile,
  returnTo,
  manage = false,
  onChanged,
}: {
  profile: RobloxConnectionProfile | null | undefined;
  returnTo: "/onboarding" | "/settings";
  manage?: boolean;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const connected = Boolean(profile?.roblox_user_id);

  async function connect() {
    setBusy("connect");
    try {
      const result = await beginRobloxOAuth({ data: { returnTo } });
      window.location.assign(result.url);
    } catch (error) {
      console.error("Roblox OAuth start failed", error);
      toast.error(t("robloxConnectUnavailable"));
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      await syncRobloxAccount();
      toast.success(t("robloxSyncSuccess"));
      onChanged?.();
    } catch (error) {
      console.error("Roblox sync failed", error);
      toast.error(t("robloxSyncUnavailable"));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm(t("robloxDisconnectConfirm"))) return;
    setBusy("disconnect");
    try {
      await disconnectRobloxAccount();
      toast.success(t("robloxDisconnectSuccess"));
      onChanged?.();
    } catch (error) {
      console.error("Roblox disconnect failed", error);
      toast.error(t("robloxDisconnectUnavailable"));
    } finally {
      setBusy(null);
    }
  }

  if (!connected) {
    return (
      <div className="rounded-2xl border border-primary/25 bg-surface p-4 shadow-sm shadow-primary/10">
        <p className="text-sm font-semibold">{t("robloxConnectLead")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("robloxConnectPrivacy")}</p>
        <Button className="mt-3 w-full" onClick={connect} disabled={busy !== null}>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-black shadow-sm dark:bg-black dark:text-white">
            <RobloxLogo />
          </span>
          {busy === "connect" ? t("robloxRedirecting") : t("robloxConnect")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/35 bg-primary/10 p-4">
      <div className="flex items-center gap-3">
        {profile?.roblox_avatar_url ? (
          <img
            src={profile.roblox_avatar_url}
            alt={t("robloxAvatarAlt")}
            className="h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2">
            <Gamepad2 className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
            <CheckCircle2 className="h-4 w-4" /> {t("robloxConnected")}
          </p>
          <p className="truncate text-sm">
            {profile?.roblox_display_name ?? profile?.roblox_username}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{profile?.roblox_username}</p>
        </div>
      </div>
      {manage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={sync} disabled={busy !== null}>
            <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
            {t("robloxSync")}
          </Button>
          <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy !== null}>
            <Unlink className="h-4 w-4" /> {t("robloxDisconnect")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
