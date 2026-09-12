import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Eye,
  MessagesSquare,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Sheet, Select, Textarea } from "@/components/ui-kit";
import { Verified } from "@/components/Verified";
import { useSession } from "@/lib/session";
import { useRoles, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

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

type Tab = "overview" | "members" | "reports" | "conversations" | "news" | "audit";

function AdminPage() {
  const { user } = useSession();
  const { isAdmin, isStaff, loading } = useRoles();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!loading && !isStaff) navigate({ to: "/accueil", replace: true });
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
    { id: "news", label: "Actualités" },
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
              tab === x.id ? "spark-gradient text-white" : "border border-border text-muted-foreground",
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

  const members = useQuery({
    queryKey: ["admin-members", search],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("id,username,roblox_username,language,verified,onboarding_completed,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (search.trim()) q = q.ilike("username", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id,role");
      const map: Record<string, AppRole[]> = {};
      for (const r of data ?? []) (map[r.user_id] ??= []).push(r.role as AppRole);
      return map;
    },
  });

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
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", id).eq("role", role);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    await log(has ? "revoke_role" : "grant_role", id, role);
    void roles.refetch();
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un pseudo"
          className="pl-10"
        />
      </div>
      {(members.data ?? []).map((m) => {
        const userRoles = roles.data?.[m.id] ?? [];
        return (
          <div key={m.id} className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  {m.username ?? "(sans pseudo)"}
                  {m.verified ? <Verified /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.roblox_username ?? "—"} · {m.language} ·{" "}
                  {m.onboarding_completed ? "profil complet" : "inscription incomplète"}
                </p>
                {userRoles.length ? (
                  <p className="mt-1 text-xs font-semibold text-primary">{userRoles.join(", ")}</p>
                ) : null}
              </div>
              <Button size="sm" variant={m.verified ? "outline" : "primary"} onClick={() => toggleVerified(m.id, !m.verified)}>
                {m.verified ? "Retirer" : "Certifier"}
              </Button>
            </div>
            {isAdmin ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["moderator", "admin"] as AppRole[]).map((r) => {
                  const has = userRoles.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => toggleRole(m.id, r, has)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold",
                        has ? "border-primary text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      {has ? `− ${r}` : `+ ${r}`}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
      {members.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun membre trouvé.</p>
      ) : null}
    </div>
  );
}

function Reports({ log }: { log: LogFn }) {
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

  async function setStatus(id: string, status: string) {
    await supabase.from("reports").update({ status, handled_at: new Date().toISOString() }).eq("id", id);
    await log("handle_report", undefined, `${id} → ${status}`);
    void reports.refetch();
  }

  if ((reports.data ?? []).length === 0)
    return <p className="text-sm text-muted-foreground">Aucun signalement.</p>;

  return (
    <div className="space-y-3">
      {(reports.data ?? []).map((r) => (
        <div key={r.id} className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{r.reason}</p>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold",
                r.status === "pending" ? "bg-destructive/15 text-destructive" : "bg-surface-2 text-muted-foreground",
              )}
            >
              {r.status}
            </span>
          </div>
          {r.details ? <p className="mt-1 text-sm text-muted-foreground">{r.details}</p> : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {new Date(r.created_at).toLocaleString("fr-FR")}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "reviewed")}>
              Traité
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "dismissed")}>
              Rejeter
            </Button>
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
                {m.sender_id.slice(0, 8)} · {new Date(m.created_at).toLocaleString("fr-FR")} · {m.kind}
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
