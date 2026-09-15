import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Crown,
  Gamepad2,
  Globe2,
  Hash,
  Home,
  Lock,
  Search,
  Send,
  Settings,
  Sparkles,
  Tag,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { PresenceDot } from "@/components/PresenceDot";
import { Verified } from "@/components/Verified";
import { Button, Input } from "@/components/ui-kit";
import { CommunitySettingsSheet } from "@/components/CommunitySettingsSheet";
import { CommunityMobileChannels } from "@/components/CommunityMobileChannels";
import type { CommunityPermission } from "@/lib/communityPermissions";
import type { Database } from "@/integrations/supabase/types";
import { useSession } from "@/lib/session";
import { LANGUAGES } from "@/lib/i18n";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/communities/$handle")({
  head: () => ({ meta: [{ title: "Communauté - Bloxspark" }] }),
  component: CommunityPage,
});

type CommunityRow = Database["public"]["Tables"]["communities"]["Row"];

// Discord-style: no more scrolling row of eight tabs — just the three things
// a member actually reaches for. Everything that used to live under "Fil" /
// "À propos" (description, rules, stats, a leaderboard preview) now lives on
// the "Accueil" entry inside Salons instead, like a server's welcome screen.
const TABS = [
  { id: "channels", label: "Salons", icon: Hash },
  { id: "members", label: "Membres", icon: Users },
  { id: "leaderboard", label: "Classement", icon: Trophy },
] as const;
type TabId = (typeof TABS)[number]["id"];

const CATEGORY_LABELS: Record<string, string> = {
  games: "Jeux",
  development: "Développement",
  creators: "Créateurs",
  roleplay: "Roleplay",
  competitive: "Compétitif",
  social: "Social",
  building: "Construction",
  community: "Communauté",
  other: "Autre",
};

const MEDAL_STYLES: Record<number, string> = {
  0: "bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 shadow-[0_0_12px_-2px_rgba(234,179,8,.6)]",
  1: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 shadow-[0_0_10px_-2px_rgba(148,163,184,.5)]",
  2: "bg-gradient-to-br from-orange-300 to-amber-600 text-orange-950 shadow-[0_0_10px_-2px_rgba(217,119,6,.45)]",
};

function CommunityPage() {
  const { handle } = Route.useParams();
  const { user } = useSession();
  const [tab, setTab] = useState<TabId>("channels");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const community = useQuery({
    queryKey: ["community", handle],
    queryFn: async () => {
      const { data } = await supabase
        .from("communities")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();
      return data;
    },
  });
  const communityId = community.data?.id;

  const membership = useQuery({
    queryKey: ["community-membership", communityId, user?.id],
    enabled: !!communityId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_members")
        .select("role")
        .eq("community_id", communityId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const isMember = !!membership.data;
  const isOwner = !!user && community.data?.owner_id === user.id;

  const myPermissions = useQuery({
    queryKey: ["community-my-permissions", communityId, user?.id],
    enabled: !!communityId && !!user,
    queryFn: async () => {
      const { data: myRoles } = await supabase
        .from("community_member_roles")
        .select("role_id")
        .eq("community_id", communityId!)
        .eq("user_id", user!.id);
      const roleIds = (myRoles ?? []).map((r) => r.role_id);
      const set = new Set<CommunityPermission>();
      if (!roleIds.length) return set;
      const { data: roles } = await supabase
        .from("community_roles")
        .select("permissions")
        .in("id", roleIds);
      for (const role of roles ?? []) {
        for (const p of role.permissions) set.add(p as CommunityPermission);
      }
      return set;
    },
  });

  function can(perm: CommunityPermission) {
    return isOwner || (myPermissions.data?.has(perm) ?? false);
  }

  const canManageAnything =
    isOwner ||
    (
      [
        "manage_community",
        "manage_channels",
        "manage_roles",
        "manage_members",
        "view_audit_log",
        "manage_affiliates",
      ] as const
    ).some((p) => myPermissions.data?.has(p));

  async function toggleJoin() {
    if (!user || !communityId) return;
    if (isMember) {
      await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("community_members")
        .insert({ community_id: communityId, user_id: user.id });
    }
    void membership.refetch();
    void community.refetch();
  }

  const c = community.data;

  if (community.isLoading) return null;
  if (!c) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center text-muted-foreground">
        Cette communauté n'existe pas.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-primary/40 to-spark-2/30 sm:h-44">
        {c.banner_url ? (
          <StoredImage path={c.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-black/20" />
        <Link
          to="/communities"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/55"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {canManageAnything ? (
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Paramètres de la communauté"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/55"
          >
            <Settings className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="px-4">
        <div className="relative z-10 -mt-10 flex items-end justify-between gap-3">
          <StoredImage
            path={c.icon_url}
            alt={c.name}
            className="h-[76px] w-[76px] shrink-0 rounded-[1.75rem] border-4 border-background bg-background object-cover shadow-xl"
            fallback="🎮"
          />
          {user ? (
            <Button
              variant={isMember ? "outline" : "primary"}
              onClick={() => void toggleJoin()}
              className="mb-1 shadow-[0_8px_20px_-10px_rgba(168,85,247,.7)]"
            >
              {isMember ? "Membre ✓" : "+ Rejoindre"}
            </Button>
          ) : null}
        </div>

        <h1 className="mt-3 flex items-center gap-1.5 text-2xl font-black">
          {c.name}
          {c.verified ? <Verified className="h-5 w-5" /> : null}
        </h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>@{c.handle}</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {c.member_count.toLocaleString()} membres
          </span>
        </p>

        <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-surface-2 p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm",
                tab === t.id
                  ? "spark-gradient text-white shadow-[0_4px_14px_-6px_rgba(168,85,247,.65)]"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "channels" ? (
            <div className="hidden lg:block">
              <ChannelsTab
                communityId={communityId}
                community={c}
                isMember={isMember}
                canManageChannels={can("manage_channels")}
                onOpenLeaderboard={() => setTab("leaderboard")}
              />
            </div>
          ) : null}
          {tab === "members" ? <MembersTab communityId={communityId} ownerId={c.owner_id} /> : null}
          {tab === "leaderboard" ? <LeaderboardTab communityId={communityId} /> : null}
        </div>
      </div>

      {tab === "channels" ? (
        <CommunityMobileChannels
          communityId={communityId}
          community={c}
          isMember={isMember}
          canManageChannels={can("manage_channels")}
          onOpenHome={() => undefined}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {communityId ? (
        <CommunitySettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          communityId={communityId}
          isOwner={isOwner}
          can={can}
        />
      ) : null}
    </div>
  );
}

function AffiliatesDisplay({ communityId }: { communityId: string | undefined }) {
  const affiliates = useQuery({
    queryKey: ["community-affiliates-display", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_affiliates")
        .select("affiliate_id")
        .eq("community_id", communityId!);
      const ids = (rows ?? []).map((r) => r.affiliate_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("communities")
        .select("id,handle,name,icon_url")
        .in("id", ids);
      return data ?? [];
    },
  });
  if (!affiliates.data?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm">
      <p className="mb-2 flex items-center gap-1.5 font-black">
        <Sparkles className="h-4 w-4 text-primary" /> Communautés affiliées
      </p>
      <div className="flex flex-wrap gap-2">
        {affiliates.data.map((a) => (
          <Link
            key={a.id}
            to="/communities/$handle"
            params={{ handle: a.handle }}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:bg-surface-2"
          >
            <StoredImage path={a.icon_url} alt="" className="h-4 w-4 rounded" fallback="🎮" />
            {a.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Shared XP aggregation behind both the full Classement tab and the compact
 *  preview shown on Accueil, so the two never drift out of sync. */
function useCommunityLeaderboard(
  communityId: string | undefined,
  since: string | null,
  limit: number,
) {
  return useQuery({
    queryKey: ["community-leaderboard", communityId, since, limit],
    enabled: !!communityId,
    queryFn: async () => {
      let query = supabase
        .from("community_xp_events")
        .select("user_id,amount")
        .eq("community_id", communityId!);
      if (since) query = query.gte("created_at", since);
      const { data: rows } = await query;
      const totals = new Map<string, number>();
      for (const r of rows ?? []) totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.amount);
      const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
      const ids = ranked.map(([id]) => id);
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return ranked.map(([id, xp]) => ({ id, xp, author: byId.get(id) }));
    },
  });
}

function RankBadge({ index }: { index: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  const style = MEDAL_STYLES[index];
  if (style) {
    return (
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm", style)}>
        {medals[index]}
      </span>
    );
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-black text-muted-foreground">
      #{index + 1}
    </span>
  );
}

function LeaderboardPreview({
  communityId,
  onOpenLeaderboard,
}: {
  communityId: string | undefined;
  onOpenLeaderboard: () => void;
}) {
  const leaderboard = useCommunityLeaderboard(communityId, null, 5);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-black">
          <Trophy className="h-4 w-4 text-amber-500" /> Classement
        </p>
        <button
          onClick={onOpenLeaderboard}
          className="text-xs font-bold text-primary transition hover:underline"
        >
          Voir tout
        </button>
      </div>
      {(leaderboard.data ?? []).length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Pas encore d'activité.</p>
      ) : (
        <div className="space-y-2">
          {(leaderboard.data ?? []).map((row, i) => (
            <div key={row.id} className="flex items-center gap-3">
              <RankBadge index={i} />
              <StoredImage
                path={row.author?.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
                fallback="🎮"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {row.author?.username ?? "?"}
              </span>
              <span className="shrink-0 text-xs font-black text-primary">
                {row.xp.toLocaleString()} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const XP_REASONS: { key: string; icon: string; label: string; amount: number }[] = [
  { key: "reply", icon: "💬", label: "Participer aux discussions", amount: 10 },
  { key: "post", icon: "📝", label: "Créer une publication", amount: 15 },
  { key: "thread", icon: "💬", label: "Lancer une discussion", amount: 15 },
  { key: "event_rsvp", icon: "📅", label: "Participer à un événement", amount: 25 },
];

const LEADERBOARD_FILTERS = [
  { id: "week", label: "Cette semaine" },
  { id: "month", label: "Ce mois-ci" },
  { id: "all", label: "Toujours" },
] as const;

function LeaderboardTab({ communityId }: { communityId: string | undefined }) {
  const [filter, setFilter] = useState<(typeof LEADERBOARD_FILTERS)[number]["id"]>("all");

  const since = (() => {
    if (filter === "week") return new Date(Date.now() - 7 * 86_400_000).toISOString();
    if (filter === "month") return new Date(Date.now() - 30 * 86_400_000).toISOString();
    return null;
  })();

  const leaderboard = useCommunityLeaderboard(communityId, since, 20);
  const topXp = Math.max(1, ...(leaderboard.data ?? []).map((row) => row.xp));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Trophy className="h-5 w-5 text-amber-500" /> Membres les plus actifs
        </h2>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {LEADERBOARD_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                filter === f.id
                  ? "spark-gradient text-white shadow-[0_4px_14px_-6px_rgba(168,85,247,.6)]"
                  : "border border-border text-muted-foreground hover:border-primary/30",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {(leaderboard.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Pas encore d'activité sur cette période.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {(leaderboard.data ?? []).map((row, i) => (
              <Link
                key={row.id}
                to="/users/$id"
                params={{ id: row.author?.username ?? row.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <RankBadge index={i} />
                <StoredImage
                  path={row.author?.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  fallback="🎮"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{row.author?.username ?? "?"}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-spark-2"
                        style={{ width: `${Math.min(100, Math.round((row.xp / topXp) * 100))}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-xs font-bold text-muted-foreground">
                      {row.xp.toLocaleString()} XP
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-black">Comment gagner de l'XP ?</p>
        <div className="mt-3 space-y-2">
          {XP_REASONS.map((r) => (
            <div key={r.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span>{r.icon}</span> {r.label}
              </span>
              <span className="font-black text-primary">+{r.amount} XP</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          L'XP ne s'achète pas - elle reflète uniquement ton activité dans la communauté.
        </p>
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

/** The "Accueil" entry pinned above the channel list — a server welcome
 *  screen à la Discord: description, key stats (including the community's
 *  own language, independent of the viewer's site language), rules and a
 *  leaderboard preview. */
function CommunityHome({
  communityId,
  community,
  onOpenLeaderboard,
}: {
  communityId: string | undefined;
  community: CommunityRow;
  onOpenLeaderboard: () => void;
}) {
  const lang = LANGUAGES.find((l) => l.code === community.language);

  return (
    <div className="space-y-4">
      {community.description ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{community.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip icon={Users} label="Membres" value={community.member_count.toLocaleString()} />
        <StatChip
          icon={Globe2}
          label="Langue"
          value={lang ? `${lang.flag} ${lang.label}` : community.language.toUpperCase()}
        />
        <StatChip
          icon={Tag}
          label="Catégorie"
          value={CATEGORY_LABELS[community.category] ?? community.category}
        />
        <StatChip
          icon={Lock}
          label="Type"
          value={
            community.visibility === "public"
              ? "Publique"
              : community.visibility === "private_friends"
                ? "Privée - amis seulement"
                : "Privée - sur demande"
          }
        />
        {community.game_name ? (
          <StatChip icon={Gamepad2} label="Jeu associé" value={community.game_name} />
        ) : null}
        <StatChip
          icon={Calendar}
          label="Créée le"
          value={new Date(community.created_at).toLocaleDateString("fr-FR")}
        />
      </div>

      {community.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {community.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      {community.rules ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="mb-2 font-black">Règles</p>
          <p className="whitespace-pre-wrap leading-relaxed">{community.rules}</p>
        </div>
      ) : null}

      <LeaderboardPreview communityId={communityId} onOpenLeaderboard={onOpenLeaderboard} />

      <AffiliatesDisplay communityId={communityId} />
    </div>
  );
}

/** Read-only member roster, grouped by top custom role like a Discord member
 *  list (owner gets a crown wherever they show up). Kick/ban/role-assignment
 *  stays in the settings sheet — this is just "who's here". */
function MembersTab({
  communityId,
  ownerId,
}: {
  communityId: string | undefined;
  ownerId: string | undefined;
}) {
  const [search, setSearch] = useState("");

  const members = useQuery({
    queryKey: ["community-members-list", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId!);
      const ids = (rows ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const [{ data: people }, { data: memberRoles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,username,avatar_url,verified,last_active_at,show_online_status,dnd")
          .in("id", ids),
        supabase
          .from("community_member_roles")
          .select("user_id,role_id")
          .eq("community_id", communityId!),
        supabase
          .from("community_roles")
          .select("id,name,color,position,is_default")
          .eq("community_id", communityId!),
      ]);
      const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
      const rolesById = new Map((roles ?? []).map((r) => [r.id, r]));
      const roleIdsByUser = new Map<string, string[]>();
      for (const mr of memberRoles ?? []) {
        (roleIdsByUser.get(mr.user_id) ?? roleIdsByUser.set(mr.user_id, []).get(mr.user_id)!).push(
          mr.role_id,
        );
      }
      return ids.map((id) => {
        const topRole = (roleIdsByUser.get(id) ?? [])
          .map((rid) => rolesById.get(rid))
          .filter((r): r is NonNullable<typeof r> => !!r && !r.is_default)
          .sort((a, b) => b.position - a.position)[0];
        return { id, person: peopleById.get(id), topRole: topRole ?? null };
      });
    },
  });

  const filtered = (members.data ?? []).filter((m) =>
    (m.person?.username ?? "").toLowerCase().includes(search.trim().toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    const posDiff = (b.topRole?.position ?? -1) - (a.topRole?.position ?? -1);
    if (posDiff !== 0) return posDiff;
    return (a.person?.username ?? "").localeCompare(b.person?.username ?? "");
  });

  const groups: { key: string; name: string; color: string | null; members: typeof sorted }[] = [];
  for (const m of sorted) {
    const key = m.topRole?.id ?? "__none__";
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        name: m.topRole?.name ?? "Membres",
        color: m.topRole?.color ?? null,
        members: [],
      };
      groups.push(group);
    }
    group.members.push(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-sm transition focus-within:border-primary/40">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        {filtered.length} membre{filtered.length > 1 ? "s" : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun membre trouvé.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                {g.color ? (
                  <span
                    className="h-2 w-2 rounded-full shadow-[0_0_6px_-1px_currentColor]"
                    style={{ background: g.color, color: g.color }}
                  />
                ) : null}
                {g.name} — {g.members.length}
              </p>
              <div className="space-y-0.5">
                {g.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-surface-2"
                  >
                    <span className="relative shrink-0">
                      <StoredImage
                        path={m.person?.avatar_url}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                        fallback="🎮"
                      />
                      {m.person ? (
                        <PresenceDot
                          profile={m.person}
                          className="absolute bottom-0 right-0 h-3 w-3"
                        />
                      ) : null}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-semibold"
                      style={g.color ? { color: g.color } : undefined}
                    >
                      {m.person?.username ?? "?"}
                    </span>
                    {m.person?.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
                    {m.id === ownerId ? (
                      <Crown
                        className="h-3.5 w-3.5 shrink-0 text-amber-400"
                        aria-label="Propriétaire"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const HOME_ID = "__home__";

function ChannelsTab({
  communityId,
  community,
  isMember,
  canManageChannels,
  onOpenLeaderboard,
}: {
  communityId: string | undefined;
  community: CommunityRow;
  isMember: boolean;
  canManageChannels: boolean;
  onOpenLeaderboard: () => void;
}) {
  const { user } = useSession();
  const [activeChannelId, setActiveChannelId] = useState<string>(HOME_ID);
  const [text, setText] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  const categories = useQuery({
    queryKey: ["community-categories", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_channel_categories")
        .select("id,name,position")
        .eq("community_id", communityId!)
        .order("position");
      return data ?? [];
    },
  });

  const channels = useQuery({
    queryKey: ["community-channels", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_channels")
        .select("id,category_id,name,position,is_default")
        .eq("community_id", communityId!)
        .order("position");
      return data ?? [];
    },
  });

  const isHome = activeChannelId === HOME_ID;

  const messages = useQuery({
    queryKey: ["community-channel-messages", activeChannelId],
    enabled: !isHome,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_channel_messages")
        .select("id,user_id,content,created_at")
        .eq("channel_id", activeChannelId)
        .order("created_at")
        .limit(200);
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({ ...r, author: byId.get(r.user_id) }));
    },
  });

  async function send() {
    if (!user || isHome || !communityId || !text.trim()) return;
    const { data: inserted, error } = await supabase
      .from("community_channel_messages")
      .insert({
        channel_id: activeChannelId,
        community_id: communityId,
        user_id: user.id,
        content: text.trim(),
      })
      .select("id")
      .single();
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    if (inserted) {
      void supabase.rpc("bump_quest_progress", {
        _metric_key: "community",
        _entity_id: inserted.id,
      });
    }
    setText("");
    void messages.refetch();
  }

  async function createChannel() {
    if (!communityId || !newChannelName.trim()) return;
    const { error } = await supabase.rpc("community_create_channel", {
      _community: communityId,
      _category: null as unknown as string,
      _name: newChannelName.trim(),
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setNewChannelName("");
    setNewChannelOpen(false);
    void channels.refetch();
  }

  // The default channel is kept in the database for compatibility with existing
  // communities, but CommunityHome is the only home entry shown in navigation.
  const visibleChannels = (channels.data ?? []).filter((c) => !c.is_default);
  const uncategorized = visibleChannels.filter((c) => !c.category_id);
  const byCategory = (categories.data ?? []).map((cat) => ({
    ...cat,
    channels: visibleChannels.filter((c) => c.category_id === cat.id),
  }));

  const channelButtonClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition",
      active
        ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px] shadow-primary/15"
        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
    );

  return (
    <div className="flex gap-3">
      <div className="w-44 shrink-0 space-y-3">
        <button onClick={() => setActiveChannelId(HOME_ID)} className={channelButtonClass(isHome)}>
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Accueil</span>
        </button>
        <div className="border-t border-border" />

        {uncategorized.length ? (
          <div className="space-y-0.5">
            {uncategorized.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannelId(ch.id)}
                className={channelButtonClass(activeChannelId === ch.id)}
              >
                <Hash className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        {byCategory.map((cat) => (
          <div key={cat.id}>
            <p className="px-2.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              {cat.name}
            </p>
            <div className="mt-1 space-y-0.5">
              {cat.channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelId(ch.id)}
                  className={channelButtonClass(activeChannelId === ch.id)}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {canManageChannels ? (
          newChannelOpen ? (
            <div className="space-y-1.5 px-1">
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="nom-du-salon"
                className="h-8 text-xs"
              />
              <Button size="sm" className="w-full" onClick={() => void createChannel()}>
                Créer
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setNewChannelOpen(true)}
              className="w-full rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            >
              + Nouveau salon
            </button>
          )
        ) : null}
      </div>

      {isHome ? (
        <div className="min-w-0 flex-1">
          <CommunityHome
            communityId={communityId}
            community={community}
            onOpenLeaderboard={onOpenLeaderboard}
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex h-80 flex-col-reverse overflow-y-auto p-3">
            <div>
              {(messages.data ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun message dans ce salon pour l'instant.
                </p>
              ) : (
                <div className="space-y-3">
                  {(messages.data ?? []).map((m) => (
                    <div key={m.id} className="flex items-start gap-2">
                      <StoredImage
                        path={m.author?.avatar_url}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-border"
                        fallback="🎮"
                      />
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-surface-2 px-3 py-2">
                        <p className="flex items-baseline gap-1.5">
                          <span className="text-xs font-black">{m.author?.username ?? "?"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </p>
                        <p className="text-sm leading-snug">{m.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {isMember ? (
            <div className="flex items-center gap-2 border-t border-border p-2.5">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="Écrire un message..."
                className="min-w-0 flex-1 rounded-full bg-surface px-3.5 py-2 text-sm outline-none ring-1 ring-transparent transition focus:ring-primary/25"
              />
              <button
                onClick={() => void send()}
                disabled={!text.trim()}
                aria-label="Envoyer"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full spark-gradient text-white transition active:scale-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
