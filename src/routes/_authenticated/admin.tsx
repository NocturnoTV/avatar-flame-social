import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  Bell,
  Crown,
  Eye,
  KeyRound,
  Mail,
  MessagesSquare,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserRound,
  Video,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Sheet, Select, Textarea } from "@/components/ui-kit";
import { Verified } from "@/components/Verified";
import { useSession } from "@/lib/session";
import { useRoles, type AppRole } from "@/lib/roles";
import { cn, errorMessage } from "@/lib/utils";
import { StoredImage } from "@/components/Media";
import { RobloxIdentity } from "@/components/RobloxIdentity";
import { adminGetMemberDetail, adminListMembers, adminManageMember } from "@/lib/admin.functions";
import { ageFrom } from "@/lib/decorations";
import { uploadFile } from "@/lib/media";
import { NEWS_CATEGORIES, slugify } from "@/lib/newsCategories";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Bloxspark" },
      { name: "description", content: "Espace de modération réservé à l'équipe Bloxspark." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Tab = "overview" | "members" | "reports" | "conversations" | "news" | "news_portal" | "audit";

function AdminPage() {
  const { user } = useSession();
  const { isAdmin, isStaff, loading } = useRoles();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!loading && !isStaff) navigate({ to: "/home", replace: true });
  }, [loading, isStaff, navigate]);

  async function log(action: string, targetUserId?: string, details?: string) {
    if (!user) return;
    await supabase.from("admin_audit_log").insert({
      admin_id: user.id,
      action,
      target_user_id: targetUserId ?? null,
      details: details ?? null,
    });
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (!isStaff) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "members", label: "Membres" },
    { id: "reports", label: "Signalements" },
    { id: "conversations", label: "Conversations" },
    { id: "news", label: "Bandeau accueil" },
    { id: "news_portal", label: "Actualités Roblox" },
    { id: "audit", label: "Journal" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-10">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Administration</h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Administrateur" : "Modérateur"} · accès restreint et journalisé
          </p>
        </div>
      </header>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === x.id
                ? "spark-gradient text-white"
                : "border border-border text-muted-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "overview" ? <Overview /> : null}
        {tab === "members" ? <Members isAdmin={isAdmin} log={log} /> : null}
        {tab === "reports" ? <Reports log={log} /> : null}
        {tab === "conversations" ? <Conversations log={log} /> : null}
        {tab === "news" ? <NewsAdmin log={log} /> : null}
        {tab === "news_portal" ? <NewsPortalAdmin log={log} /> : null}
        {tab === "audit" ? <Audit /> : null}
      </div>
    </div>
  );
}

function useCount(table: string, filter?: (q: ReturnType<typeof supabase.from>) => unknown) {
  return useQuery({
    queryKey: ["admin-count", table],
    queryFn: async () => {
      const { count } = await supabase
        .from(table as never)
        .select("*", { count: "exact", head: true });
      void filter;
      return count ?? 0;
    },
  });
}

function Overview() {
  const members = useCount("profiles");
  const matches = useCount("matches");
  const messages = useCount("messages");
  const videos = useCount("videos");
  const reports = useCount("reports");
  const requests = useCount("data_requests");

  const cards = [
    { label: "Membres", value: members.data, icon: Users },
    { label: "Matchs", value: matches.data, icon: BadgeCheck },
    { label: "Messages", value: messages.data, icon: MessagesSquare },
    { label: "Vidéos", value: videos.data, icon: Eye },
    { label: "Signalements", value: reports.data, icon: AlertTriangle },
    { label: "Demandes RGPD", value: requests.data, icon: ShieldCheck },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-3xl border border-border bg-card p-4">
          <c.icon className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{c.value ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

type LogFn = (action: string, targetUserId?: string, details?: string) => Promise<void>;

function Members({ isAdmin, log }: { isAdmin: boolean; log: LogFn }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const members = useQuery({ queryKey: ["admin-members-v2"], queryFn: () => adminListMembers() });
  const detail = useQuery({
    queryKey: ["admin-member-detail", selectedId],
    enabled: !!selectedId,
    queryFn: () => adminGetMemberDetail({ data: { userId: selectedId! } }),
  });

  const rows = (members.data ?? []).filter((member) => {
    const haystack =
      `${member.username ?? ""} ${member.roblox_username ?? ""} ${member.email ?? ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const selected = (members.data ?? []).find((member) => member.id === selectedId);

  async function act(
    action: Parameters<typeof adminManageMember>[0]["data"]["action"],
    value?: string,
    targetId?: string,
  ) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await adminManageMember({ data: { action, userId: selectedId, value, targetId } });
      toast.success("Action enregistrée et journalisée");
      setNote("");
      setNewPassword("");
      await Promise.all([members.refetch(), detail.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVerified(id: string, next: boolean) {
    const { error } = await supabase.from("profiles").update({ verified: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log(next ? "verify_member" : "unverify_member", id);
    toast.success(next ? "Membre certifié" : "Certification retirée");
    void members.refetch();
  }

  async function toggleRole(id: string, role: AppRole, has: boolean) {
    if (has) await supabase.from("user_roles").delete().eq("user_id", id).eq("role", role);
    else {
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    await log(has ? "revoke_role" : "grant_role", id, role);
    void members.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
          Centre de contrôle
        </p>
        <h2 className="mt-1 text-2xl font-black">Gestion complète des membres</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Identité, accès, sanctions et activité réunis dans un dossier de modération journalisé.
        </p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pseudo, Roblox ou e-mail"
            className="bg-background/70 pl-10"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((member) => {
          const banned =
            member.moderation_status === "banned" ||
            (!!member.bannedUntil && new Date(String(member.bannedUntil)) > new Date());
          return (
            <article
              key={member.id}
              className="rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex gap-3">
                <StoredImage
                  path={member.avatar_url as string | null}
                  alt=""
                  className="h-14 w-14 rounded-2xl"
                  fallback="🎮"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-black">
                    {member.username ?? "Profil incomplet"} {member.verified ? <Verified /> : null}
                  </p>
                  <RobloxIdentity
                    displayName={member.roblox_display_name as string | null}
                    username={member.roblox_username as string | null}
                    className="mt-0.5 max-w-full text-xs text-muted-foreground"
                  />
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {member.email ?? "E-mail indisponible"}
                  </p>
                </div>
                <span
                  className={cn(
                    "h-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase",
                    banned
                      ? "bg-destructive/15 text-destructive"
                      : member.moderation_status === "warned"
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-primary/10 text-primary",
                  )}
                >
                  {banned
                    ? "Banni"
                    : member.moderation_status === "warned"
                      ? `${member.warning_count} avert.`
                      : "Actif"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span>
                  {member.onboarding_completed ? "✓ Profil terminé" : "○ Onboarding requis"}
                </span>
                <span>
                  {member.emailConfirmedAt ? "✓ E-mail confirmé" : "○ E-mail non confirmé"}
                </span>
                <span>
                  Vu{" "}
                  {member.last_active_at
                    ? new Date(String(member.last_active_at)).toLocaleDateString("fr-FR")
                    : "—"}
                </span>
                <span>{(member.roles as string[]).join(", ") || "membre"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedId(String(member.id));
                    setNewEmail(String(member.email ?? ""));
                  }}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" /> Ouvrir le dossier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleVerified(String(member.id), !member.verified)}
                >
                  {member.verified ? "Décertifier" : "Certifier"}
                </Button>
              </div>
              {isAdmin ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["moderator", "admin"] as AppRole[]).map((role) => {
                    const has = (member.roles as string[]).includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRole(String(member.id), role, has)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          has
                            ? "border-primary text-primary"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {has ? `− ${role}` : `+ ${role}`}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!rows.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun membre trouvé.</p>
      ) : null}

      <Sheet
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={`Dossier · ${selected?.username ?? "membre"}`}
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <StoredImage
                path={selected.avatar_url as string | null}
                alt=""
                className="h-16 w-16 rounded-2xl"
                fallback="🎮"
              />
              <div className="min-w-0">
                <p className="font-black">{selected.username ?? "Profil incomplet"}</p>
                <p className="truncate text-xs text-muted-foreground">{selected.email}</p>
                <RobloxIdentity
                  displayName={selected.roblox_display_name as string | null}
                  username={selected.roblox_username as string | null}
                  className="mt-1 max-w-full text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                [detail.data?.videos.length ?? 0, "vidéos"],
                [detail.data?.messages.length ?? 0, "messages"],
                [detail.data?.reports.length ?? 0, "signalements"],
                [detail.data?.notifications.length ?? 0, "notifications"],
              ].map(([value, label]) => (
                <div key={String(label)} className="rounded-2xl bg-primary/10 p-2 text-center">
                  <p className="font-black text-primary">{value}</p>
                  <p className="truncate text-[9px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 font-black">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Modération
              </h3>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Motif de l’avertissement ou contenu de la notification…"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={busy || !note.trim()}
                  onClick={() => act("warn", note)}
                >
                  <AlertTriangle className="mr-1 h-4 w-4" /> Avertir
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !note.trim()}
                  onClick={() => act("notify", note)}
                >
                  <Bell className="mr-1 h-4 w-4" /> Notifier
                </Button>
                {isAdmin ? (
                  selected.moderation_status === "banned" ? (
                    <Button className="col-span-2" disabled={busy} onClick={() => act("unban")}>
                      <Unlock className="mr-1 h-4 w-4" /> Débannir
                    </Button>
                  ) : (
                    <Button
                      className="col-span-2"
                      variant="danger"
                      disabled={busy}
                      onClick={() => act("ban", note || "Permanent ban")}
                    >
                      <Ban className="mr-1 h-4 w-4" /> Bannir le compte
                    </Button>
                  )
                ) : null}
              </div>
              {selected.moderation_note ? (
                <p className="rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-600">
                  Dernière note : {String(selected.moderation_note)}
                </p>
              ) : null}
            </section>

            {isAdmin ? (
              <section className="space-y-3 border-t border-border pt-4">
                <h3 className="flex items-center gap-2 font-black">
                  <Crown className="h-4 w-4 text-primary" /> Bloxspark Plus
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selected.sparkPlusActive
                    ? selected.sparkPlusExpiresAt
                      ? `Actif jusqu'au ${new Date(String(selected.sparkPlusExpiresAt)).toLocaleDateString("fr-FR")}`
                      : "Actif à vie"
                    : "Pas de Spark Plus actif"}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ["1m", "+1 mois"],
                      ["3m", "+3 mois"],
                      ["1y", "+1 an"],
                      ["lifetime", "À vie"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => act("grant_spark_plus", value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {selected.sparkPlusActive ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => act("revoke_spark_plus")}
                  >
                    Retirer Spark Plus
                  </Button>
                ) : null}
              </section>
            ) : null}

            {isAdmin ? (
              <section className="space-y-3 border-t border-border pt-4">
                <h3 className="flex items-center gap-2 font-black">
                  <UserRound className="h-4 w-4 text-primary" /> Accès au compte
                </h3>
                <p className="text-xs text-muted-foreground">
                  Le mot de passe actuel reste invisible. Tu peux uniquement en définir un nouveau.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={busy || !newEmail}
                    onClick={() => act("update_email", newEmail)}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nouveau mot de passe (8 caractères min.)"
                  />
                  <Button
                    variant="outline"
                    disabled={busy || newPassword.length < 8}
                    onClick={() => act("update_password", newPassword)}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="border-t border-border pt-4">
              <h3 className="flex items-center gap-2 font-black">
                <Video className="h-4 w-4 text-primary" /> Vidéos ({detail.data?.videos.length ?? 0}
                )
              </h3>
              <div className="mt-3 space-y-2">
                {detail.data?.videos.map((video) => (
                  <div key={video.id} className="rounded-2xl bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {video.caption || "Vidéo sans légende"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {video.views_count} vues · {video.visibility} ·{" "}
                          {new Date(video.created_at).toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="rounded-full border border-border p-2"
                          aria-label={video.visibility === "public" ? "Masquer" : "Restaurer"}
                          onClick={() =>
                            act(
                              video.visibility === "public" ? "hide_video" : "restore_video",
                              undefined,
                              video.id,
                            )
                          }
                        >
                          {video.visibility === "public" ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          className="rounded-full border border-border p-2 text-destructive"
                          aria-label="Supprimer"
                          onClick={() => act("delete_video", undefined, video.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {detail.isLoading ? (
                  <p className="text-xs text-muted-foreground">Chargement de l’activité…</p>
                ) : null}
              </div>
            </section>

            <section className="border-t border-border pt-4">
              <h3 className="flex items-center gap-2 font-black">
                <Bell className="h-4 w-4 text-primary" /> Historique des notifications (
                {detail.data?.notifications.length ?? 0})
              </h3>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {detail.data?.notifications.map((notification) => (
                  <div key={notification.id} className="rounded-2xl bg-surface p-3">
                    <p className="text-[10px] text-muted-foreground">
                      {notification.kind} · {notification.read ? "lue" : "non lue"} ·{" "}
                      {new Date(notification.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="mt-1 break-words text-sm">{notification.body || "—"}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-border pt-4">
              <h3 className="flex items-center gap-2 font-black">
                <AlertTriangle className="h-4 w-4 text-primary" /> Signalements liés au membre (
                {detail.data?.reports.length ?? 0})
              </h3>
              <div className="mt-3 space-y-2">
                {detail.data?.reports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-border p-3 text-xs">
                    <p className="font-bold">{report.reason}</p>
                    <p className="text-muted-foreground">
                      {report.status} · {new Date(report.created_at).toLocaleString("fr-FR")}
                    </p>
                    {report.details ? <p className="mt-1">{report.details}</p> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-border pt-4">
              <h3 className="flex items-center gap-2 font-black">
                <MessagesSquare className="h-4 w-4 text-primary" /> Historique des messages (
                {detail.data?.messages.length ?? 0})
              </h3>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {detail.data?.messages.map((message) => (
                  <div key={message.id} className="rounded-2xl bg-surface p-3">
                    <p className="text-[10px] text-muted-foreground">
                      {message.kind} · {new Date(message.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="mt-1 break-words text-sm">{message.content || "(média)"}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-border pt-4">
              <h3 className="font-black">Journal du membre</h3>
              <div className="mt-3 space-y-2">
                {detail.data?.audit.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border p-3 text-xs">
                    <p className="font-bold">{entry.action}</p>
                    <p className="text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("fr-FR")}
                      {entry.details ? ` · ${entry.details}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

type ReportProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  birth_date: string | null;
};

function Reports({ log }: { log: LogFn }) {
  const [subTab, setSubTab] = useState<"reports" | "banned_words">("reports");
  const [fileUserId, setFileUserId] = useState<string | null>(null);

  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id,reason,details,status,created_at,reporter_id,target_user_id,message_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const messages = useQuery({
    queryKey: ["admin-report-messages", (reports.data ?? []).map((r) => r.message_id).join(",")],
    enabled: (reports.data ?? []).some((r) => r.message_id),
    queryFn: async () => {
      const ids = (reports.data ?? []).map((r) => r.message_id).filter((id): id is string => !!id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("messages")
        .select("id,content,kind,media_url,created_at")
        .in("id", ids);
      return data ?? [];
    },
  });

  const profiles = useQuery({
    queryKey: [
      "admin-report-profiles",
      (reports.data ?? []).map((r) => `${r.reporter_id}-${r.target_user_id}`).join(","),
    ],
    enabled: (reports.data ?? []).length > 0,
    queryFn: async (): Promise<Record<string, ReportProfile>> => {
      const ids = [
        ...new Set(
          (reports.data ?? []).flatMap((r) => [r.reporter_id, r.target_user_id].filter(Boolean)),
        ),
      ] as string[];
      if (!ids.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,roblox_username,roblox_display_name,birth_date")
        .in("id", ids);
      const map: Record<string, ReportProfile> = {};
      for (const p of data ?? []) map[p.id] = p;
      return map;
    },
  });

  const fileDetail = useQuery({
    queryKey: ["admin-member-detail", fileUserId],
    enabled: !!fileUserId,
    queryFn: () => adminGetMemberDetail({ data: { userId: fileUserId! } }),
  });

  async function setStatus(id: string, status: string) {
    await supabase
      .from("reports")
      .update({ status, handled_at: new Date().toISOString() })
      .eq("id", id);
    await log("handle_report", undefined, `${id} → ${status}`);
    void reports.refetch();
  }

  const fileProfile = fileUserId ? profiles.data?.[fileUserId] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ["reports", "Signalements"],
            ["banned_words", "Mots bannis"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              subTab === id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "banned_words" ? (
        <BannedWords log={log} />
      ) : (reports.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun signalement.</p>
      ) : (
        <div className="space-y-3">
          {(reports.data ?? []).map((r) => {
            const reporter = r.reporter_id ? profiles.data?.[r.reporter_id] : undefined;
            const target = r.target_user_id ? profiles.data?.[r.target_user_id] : undefined;
            const message = r.message_id
              ? (messages.data ?? []).find((m) => m.id === r.message_id)
              : undefined;
            return (
              <div key={r.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{r.reason}</p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      r.status === "pending"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-surface-2 text-muted-foreground",
                    )}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("fr-FR")}
                </p>

                {r.details ? (
                  <div className="mt-2 rounded-2xl bg-surface p-3 text-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Détails du signalement
                    </p>
                    <p className="mt-1">{r.details}</p>
                  </div>
                ) : null}

                {message ? (
                  <div className="mt-2 rounded-2xl bg-destructive/10 p-3 text-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">
                      Contenu signalé ({message.kind})
                    </p>
                    <p className="mt-1 break-words">{message.content ?? "(média)"}</p>
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <ReportPersonCard
                    label="Signalé par"
                    profile={reporter}
                    fallbackId={r.reporter_id}
                    onOpenFile={setFileUserId}
                  />
                  <ReportPersonCard
                    label="Utilisateur signalé"
                    profile={target}
                    fallbackId={r.target_user_id}
                    onOpenFile={setFileUserId}
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "reviewed")}>
                    Traité
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "dismissed")}>
                    Rejeter
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!fileUserId}
        onClose={() => setFileUserId(null)}
        title={`Dossier · ${fileProfile?.username ?? "membre"}`}
      >
        {fileUserId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <StoredImage
                path={fileProfile?.avatar_url ?? null}
                alt=""
                className="h-16 w-16 rounded-2xl"
                fallback="🎮"
              />
              <div className="min-w-0">
                <p className="font-black">{fileProfile?.username ?? "Profil incomplet"}</p>
                <RobloxIdentity
                  displayName={fileProfile?.roblox_display_name ?? null}
                  username={fileProfile?.roblox_username ?? null}
                  className="mt-1 max-w-full text-xs"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {fileProfile?.birth_date
                    ? `${ageFrom(fileProfile.birth_date)} ans (${new Date(fileProfile.birth_date).toLocaleDateString("fr-FR")})`
                    : "Date de naissance inconnue"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                [fileDetail.data?.videos.length ?? 0, "vidéos"],
                [fileDetail.data?.messages.length ?? 0, "messages"],
                [fileDetail.data?.reports.length ?? 0, "signalements"],
                [fileDetail.data?.notifications.length ?? 0, "notifications"],
              ].map(([value, label]) => (
                <div key={String(label)} className="rounded-2xl bg-primary/10 p-2 text-center">
                  <p className="font-black text-primary">{value}</p>
                  <p className="truncate text-[9px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {fileDetail.data?.audit.length ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Historique de modération
                </p>
                <div className="space-y-1.5">
                  {fileDetail.data.audit.slice(0, 10).map((a) => (
                    <p key={a.id} className="rounded-xl bg-surface p-2 text-xs text-muted-foreground">
                      {a.action} {a.details ? `— ${a.details}` : ""} ·{" "}
                      {new Date(a.created_at).toLocaleString("fr-FR")}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function ReportPersonCard({
  label,
  profile,
  fallbackId,
  onOpenFile,
}: {
  label: string;
  profile: ReportProfile | undefined;
  fallbackId: string | null;
  onOpenFile: (id: string) => void;
}) {
  if (!fallbackId) return null;
  return (
    <div className="rounded-2xl border border-border p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <StoredImage
          path={profile?.avatar_url ?? null}
          alt=""
          className="h-9 w-9 rounded-full"
          fallback="🎮"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{profile?.username ?? fallbackId.slice(0, 8)}</p>
          <RobloxIdentity
            displayName={profile?.roblox_display_name ?? null}
            username={profile?.roblox_username ?? null}
            className="max-w-full text-[11px] text-muted-foreground"
          />
          <p className="text-[10px] text-muted-foreground">
            {profile?.birth_date ? `${ageFrom(profile.birth_date)} ans` : "Âge inconnu"}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => onOpenFile(fallbackId)}>
        <Eye className="mr-1 h-3.5 w-3.5" /> Consulter le dossier
      </Button>
    </div>
  );
}

function BannedWords({ log }: { log: LogFn }) {
  const [word, setWord] = useState("");
  const [language, setLanguage] = useState<"en" | "fr">("fr");

  const words = useQuery({
    queryKey: ["admin-banned-words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banned_words")
        .select("id,word,language,created_at")
        .order("language")
        .order("word");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addWord() {
    const value = word.trim().toLowerCase();
    if (!value) return;
    const { error } = await supabase.from("banned_words").insert({ word: value, language });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ce mot est déjà dans la liste." : error.message);
      return;
    }
    setWord("");
    await log("add_banned_word", undefined, `${value} (${language})`);
    void words.refetch();
  }

  async function removeWord(id: string, label: string) {
    await supabase.from("banned_words").delete().eq("id", id);
    await log("remove_banned_word", undefined, label);
    void words.refetch();
  }

  const en = (words.data ?? []).filter((w) => w.language === "en");
  const fr = (words.data ?? []).filter((w) => w.language === "fr");

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Ces mots déclenchent automatiquement un message de prévention Trust &amp; Safety (traduit
          selon la langue du destinataire) dans la conversation ou sous le commentaire concerné.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Ajouter un mot"
            onKeyDown={(e) => e.key === "Enter" && addWord()}
          />
          <Select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "fr")} className="w-28">
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </Select>
          <Button onClick={() => void addWord()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {([
        ["Français", fr],
        ["English", en],
      ] as const).map(([label, list]) => (
        <div key={label}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {label} ({list.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {list.map((w) => (
              <span
                key={w.id}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
              >
                {w.word}
                <button
                  onClick={() => void removeWord(w.id, `${w.word} (${w.language})`)}
                  aria-label={`Retirer ${w.word}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
            {list.length === 0 ? <p className="text-sm text-muted-foreground">Aucun mot.</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Conversations({ log }: { log: LogFn }) {
  const [open, setOpen] = useState<string | null>(null);

  const conversations = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id,is_group,name,last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const messages = useQuery({
    queryKey: ["admin-messages", open],
    enabled: !!open,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,sender_id,kind,content,created_at")
        .eq("conversation_id", open ?? "")
        .order("created_at")
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        La consultation d'une conversation est enregistrée dans le journal d'audit.
      </p>
      {(conversations.data ?? []).map((c) => (
        <button
          key={c.id}
          onClick={async () => {
            setOpen(c.id);
            await log("view_conversation", undefined, c.id);
          }}
          className="flex w-full items-center justify-between rounded-3xl border border-border bg-card p-4 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {c.is_group ? (c.name ?? "Groupe") : "Conversation privée"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {new Date(c.last_message_at).toLocaleString("fr-FR")}
            </span>
          </span>
          <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}

      <Sheet open={!!open} onClose={() => setOpen(null)} title="Messages">
        <div className="space-y-2 text-sm">
          {(messages.data ?? []).map((m) => (
            <div key={m.id} className="rounded-2xl bg-surface p-3">
              <p className="text-[11px] text-muted-foreground">
                {m.sender_id.slice(0, 8)} · {new Date(m.created_at).toLocaleString("fr-FR")} ·{" "}
                {m.kind}
              </p>
              <p className="mt-1 break-words">{m.content ?? "(média)"}</p>
            </div>
          ))}
          {(messages.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">Aucun message.</p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

function Audit() {
  const logs = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("id,action,details,created_at,admin_id,target_user_id")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  if ((logs.data ?? []).length === 0)
    return <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>;

  return (
    <div className="space-y-2">
      {(logs.data ?? []).map((l) => (
        <div key={l.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
          <p className="font-semibold">{l.action}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(l.created_at).toLocaleString("fr-FR")}
            {l.details ? ` · ${l.details}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

const TONES = [
  { value: "from-blue-500 to-cyan-400", label: "Bleu" },
  { value: "from-fuchsia-500 to-pink-400", label: "Rose" },
  { value: "from-amber-400 to-yellow-300", label: "Or" },
  { value: "from-emerald-500 to-lime-400", label: "Vert" },
  { value: "from-violet-500 to-indigo-400", label: "Violet" },
];

type NewsRow = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  url: string | null;
  tone: string;
  position: number;
  published: boolean;
};

function NewsAdmin({ log }: { log: (a: string, u?: string, d?: string) => Promise<void> }) {
  const empty = {
    title: "",
    subtitle: "",
    body: "",
    url: "",
    tone: TONES[0]!.value,
    position: 0,
    published: true,
  };
  const [form, setForm] = useState<typeof empty & { id?: string }>(empty);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["admin-news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news")
        .select("id,title,subtitle,body,url,tone,position,published")
        .order("position")
        .order("created_at", { ascending: false });
      return (data ?? []) as NewsRow[];
    },
  });

  async function save() {
    if (!form.title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      body: form.body.trim() || null,
      url: form.url.trim() || null,
      tone: form.tone,
      position: Number(form.position) || 0,
      published: form.published,
    };
    const { error } = form.id
      ? await supabase.from("news").update(payload).eq("id", form.id)
      : await supabase.from("news").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log(form.id ? "news_update" : "news_create", undefined, payload.title);
    toast.success("Actualité enregistrée");
    setForm(empty);
    void list.refetch();
  }

  async function remove(row: NewsRow) {
    const { error } = await supabase.from("news").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("news_delete", undefined, row.title);
    if (form.id === row.id) setForm(empty);
    toast.success("Actualité supprimée");
    void list.refetch();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <p className="font-bold">{form.id ? "Modifier l'actualité" : "Nouvelle actualité"}</p>
        </div>
        <div>
          <Label>Titre</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Sous-titre</Label>
          <Input
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          />
        </div>
        <div>
          <Label>Article</Label>
          <Textarea
            rows={6}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Contenu complet de l'article…"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Lien (optionnel)</Label>
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div>
            <Label>Couleur</Label>
            <Select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
              {TONES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Ordre</Label>
            <Input
              type="number"
              value={String(form.position)}
              onChange={(e) => setForm({ ...form, position: Number(e.target.value) })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--spark)]"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Publiée sur la page d'accueil
        </label>
        <div className="flex gap-3">
          <Button onClick={save} disabled={busy}>
            <Plus className="mr-1 h-4 w-4" />
            {form.id ? "Enregistrer" : "Publier"}
          </Button>
          {form.id ? (
            <Button variant="outline" onClick={() => setForm(empty)}>
              Annuler
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {(list.data ?? []).map((n) => (
          <div key={n.id} className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{n.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {n.subtitle ?? "—"} · {n.published ? "publiée" : "brouillon"} · ordre {n.position}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: n.id,
                      title: n.title,
                      subtitle: n.subtitle ?? "",
                      body: n.body ?? "",
                      url: n.url ?? "",
                      tone: n.tone,
                      position: n.position,
                      published: n.published,
                    })
                  }
                >
                  Modifier
                </Button>
                <button
                  onClick={() => void remove(n)}
                  className="rounded-full border border-border p-2 text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {list.data && list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune actualité pour le moment.</p>
        ) : null}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Programmé",
  published: "Publié",
  archived: "Archivé",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-surface-2 text-muted-foreground",
  scheduled: "bg-amber-500/15 text-amber-500",
  published: "bg-emerald-500/15 text-emerald-500",
  archived: "bg-red-500/10 text-red-400",
};

type ArticleForm = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image_url: string | null;
  category: string;
  source: string;
  source_url: string;
  status: string;
  featured: boolean;
  scheduled_for: string;
  reading_time_minutes: string;
  tags: string;
  key_points: string;
};

const EMPTY_ARTICLE: ArticleForm = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  image_url: null,
  category: "updates",
  source: "Bloxspark",
  source_url: "",
  status: "draft",
  featured: false,
  scheduled_for: "",
  reading_time_minutes: "3",
  tags: "",
  key_points: "",
};

function NewsPortalAdmin({ log }: { log: LogFn }) {
  const { user } = useSession();
  const [form, setForm] = useState<ArticleForm | null>(null);
  const [saving, setSaving] = useState(false);

  const articles = useQuery({
    queryKey: ["admin-news-articles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("id,title,slug,category,status,featured,published_at,scheduled_for,created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  function startNew() {
    setForm({ ...EMPTY_ARTICLE });
  }

  async function startEdit(id: string) {
    const { data } = await supabase.from("news_articles").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    setForm({
      id: data.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt ?? "",
      content: data.content,
      image_url: data.image_url,
      category: data.category,
      source: data.source,
      source_url: data.source_url ?? "",
      status: data.status,
      featured: data.featured,
      scheduled_for: data.scheduled_for ? data.scheduled_for.slice(0, 16) : "",
      reading_time_minutes: String(data.reading_time_minutes),
      tags: data.tags.join(", "),
      key_points: data.key_points.join("\n"),
    });
  }

  async function uploadImage(file: File) {
    if (!user || !form) return;
    try {
      const path = await uploadFile("news-articles", user.id, file, file.name.split(".").pop() ?? "jpg");
      setForm({ ...form, image_url: path });
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  async function save() {
    if (!user || !form || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      excerpt: form.excerpt.trim() || null,
      content: form.content,
      image_url: form.image_url,
      category: form.category,
      source: form.source.trim() || "Bloxspark",
      source_url: form.source_url.trim() || null,
      status: form.status,
      featured: form.featured,
      scheduled_for: form.status === "scheduled" && form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
      published_at: form.status === "published" ? new Date().toISOString() : null,
      reading_time_minutes: Number(form.reading_time_minutes) || 3,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      key_points: form.key_points.split("\n").map((t) => t.trim()).filter(Boolean),
      author_id: user.id,
    };
    const { error } = form.id
      ? await supabase.from("news_articles").update(payload).eq("id", form.id)
      : await supabase.from("news_articles").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    await log(form.id ? "news_article_update" : "news_article_create", undefined, form.title.trim());
    toast.success("Enregistré.");
    setForm(null);
    void articles.refetch();
  }

  async function remove(id: string, title: string) {
    await supabase.from("news_articles").delete().eq("id", id);
    await log("news_article_delete", undefined, title);
    void articles.refetch();
  }


  if (form) {
    return (
      <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold">{form.id ? "Modifier l'article" : "Nouvel article"}</p>
          <button onClick={() => setForm(null)} className="text-sm text-muted-foreground">
            Annuler
          </button>
        </div>

        <div>
          <Label>Image</Label>
          <label className="block h-32 cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface">
            {form.image_url ? (
              <StoredImage path={form.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                Choisir une image
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div>
          <Label>Titre</Label>
          <Input
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
                slug: form.slug || slugify(e.target.value),
              })
            }
          />
        </div>
        <div>
          <Label>Slug (URL)</Label>
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
        </div>
        <div>
          <Label>Chapô (max 300 caractères)</Label>
          <Textarea
            value={form.excerpt}
            maxLength={300}
            rows={2}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          />
        </div>
        <div>
          <Label>Contenu</Label>
          <p className="mb-1 text-xs text-muted-foreground">
            Paragraphes séparés par une ligne vide. Commence une ligne par "## " pour un titre de section
            (utilisé pour le sommaire). Une ligne commençant par "&gt; " devient une citation.
          </p>
          <Textarea value={form.content} rows={10} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </div>
        <div>
          <Label>Points clés (un par ligne)</Label>
          <Textarea
            value={form.key_points}
            rows={4}
            onChange={(e) => setForm({ ...form, key_points: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Catégorie</Label>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {NEWS_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Temps de lecture (min)</Label>
            <Input
              type="number"
              value={form.reading_time_minutes}
              onChange={(e) => setForm({ ...form, reading_time_minutes: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Source</Label>
            <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <div>
            <Label>Lien source externe (optionnel)</Label>
            <Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Tags (séparés par des virgules)</Label>
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Statut</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Brouillon</option>
              <option value="scheduled">Programmé</option>
              <option value="published">Publié</option>
              <option value="archived">Archivé</option>
            </Select>
          </div>
          {form.status === "scheduled" ? (
            <div>
              <Label>Date de publication</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_for}
                onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
              />
            </div>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
          />
          Mettre à la une
        </label>

        <Button className="w-full" disabled={!form.title.trim() || saving} onClick={() => void save()}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{articles.data?.length ?? 0} article(s)</p>
        <Button size="sm" onClick={startNew}>
          <Plus className="h-4 w-4" /> Nouvel article
        </Button>
      </div>
      <div className="space-y-2">
        {(articles.data ?? []).map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {a.featured ? "★ " : ""}
                {a.title}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("rounded-full px-2 py-0.5 font-bold", STATUS_COLORS[a.status])}>
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
                {NEWS_CATEGORIES.find((c) => c.id === a.category)?.label ?? a.category}
              </p>
            </div>
            <button onClick={() => void startEdit(a.id)} className="text-xs font-semibold text-primary">
              Modifier
            </button>
            <button
              onClick={() => void remove(a.id, a.title)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {articles.data?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun article pour l'instant.</p>
        ) : null}
      </div>
    </div>
  );
}
