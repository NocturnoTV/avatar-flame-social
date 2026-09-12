import { CheckCircle2, Gamepad2, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui-kit";
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
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const connected = Boolean(profile?.roblox_user_id);

  async function connect() {
    setBusy("connect");
    try {
      const result = await beginRobloxOAuth({ data: { returnTo } });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connexion Roblox indisponible.");
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      await syncRobloxAccount();
      toast.success("Compte Roblox resynchronisé.");
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synchronisation impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Déconnecter ce compte Roblox de BloxSpark ?")) return;
    setBusy("disconnect");
    try {
      await disconnectRobloxAccount();
      toast.success("Compte Roblox déconnecté.");
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Déconnexion impossible.");
    } finally {
      setBusy(null);
    }
  }

  if (!connected) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold">
          Récupère automatiquement ton pseudo, ton avatar et tes jeux.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          BloxSpark demande uniquement ton identité publique Roblox.
        </p>
        <Button className="mt-3 w-full" onClick={connect} disabled={busy !== null}>
          <Gamepad2 className="h-4 w-4" />
          {busy === "connect" ? "Redirection vers Roblox…" : "Connecter mon compte Roblox"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4">
      <div className="flex items-center gap-3">
        {profile?.roblox_avatar_url ? (
          <img
            src={profile.roblox_avatar_url}
            alt="Avatar Roblox"
            className="h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2">
            <Gamepad2 className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-500">
            <CheckCircle2 className="h-4 w-4" /> Compte Roblox connecté
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
            Resynchroniser
          </Button>
          <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy !== null}>
            <Unlink className="h-4 w-4" /> Déconnecter
          </Button>
        </div>
      ) : null}
    </div>
  );
}
