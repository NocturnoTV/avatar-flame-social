import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  Code2,
  Compass,
  Flame,
  Gamepad2,
  Globe2,
  Medal,
  Plus,
  Search,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { LogoWordmark } from "@/components/Logo";
import { Verified } from "@/components/Verified";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/communities/")({
  head: () => ({
    meta: [
      { title: "Communautés - Bloxspark" },
      {
        name: "description",
        content: "Rejoins des communautés qui partagent tes jeux et tes intérêts.",
      },
    ],
  }),
  component: CommunitiesPage,
});

type CommunityRow = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  category: string;
  language: string;
  banner_url: string | null;
  icon_url: string | null;
  tags: string[];
  verified: boolean;
  member_count: number;
  activity_points: number;
  rank_position: number;
  ranking_score: number;
};

const CATEGORY_FILTERS: { id: string; label: string; icon: typeof Sparkles }[] = [
  { id: "foryou", label: "Pour toi", icon: Sparkles },
  { id: "popular", label: "Populaires", icon: Flame },
  { id: "ranking", label: "Classement", icon: Trophy },
  { id: "new", label: "Nouvelles", icon: Compass },
  { id: "games", label: "Jeux", icon: Gamepad2 },
  { id: "development", label: "Développement", icon: Code2 },
  { id: "creators", label: "Créateurs", icon: Video },
  { id: "fr", label: "FR", icon: Globe2 },
  { id: "international", label: "International", icon: Globe2 },
];

const RANK_STYLES: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 shadow-[0_0_14px_-2px_rgba(234,179,8,.65)]",
  2: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 shadow-[0_0_12px_-2px_rgba(148,163,184,.55)]",
  3: "bg-gradient-to-br from-orange-300 to-amber-600 text-orange-950 shadow-[0_0_12px_-2px_rgba(217,119,6,.5)]",
};

function CommunitiesPage() {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("foryou");

  const myProfile = useQuery({
    queryKey: ["communities-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const myMemberships = useQuery({
    queryKey: ["communities-my-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user!.id);
      return new Set((data ?? []).map((m) => m.community_id));
    },
  });

  const communities = useQuery({
    queryKey: ["communities-directory"],
    queryFn: async (): Promise<CommunityRow[]> => {
      const [{ data, error }, { data: rankings, error: rankingError }] = await Promise.all([
        supabase
          .from("communities")
          .select(
            "id,handle,name,description,category,language,banner_url,icon_url,tags,verified,member_count",
          )
          .eq("visibility", "public")
          .order("member_count", { ascending: false }),
        supabase.rpc("community_directory_rankings"),
      ]);
      if (error) throw error;
      if (rankingError) throw rankingError;
      const byCommunity = new Map((rankings ?? []).map((row) => [row.community_id, row]));
      return (data ?? []).map((community) => {
        const ranking = byCommunity.get(community.id);
        return {
          ...community,
          activity_points: Number(ranking?.activity_points ?? 0),
          rank_position: Number(ranking?.rank_position ?? 0),
          ranking_score: Number(ranking?.ranking_score ?? 0),
        };
      });
    },
  });

  async function toggleJoin(communityId: string, joined: boolean) {
    if (!user) return;
    if (joined) {
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
    void myMemberships.refetch();
    void communities.refetch();
  }

  const all = communities.data ?? [];
  const mine = myMemberships.data ?? new Set<string>();
  const myLang = myProfile.data?.language;

  const searched = search.trim()
    ? all.filter((c) => {
        const q = search.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.language.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
    : all;

  const filtered = (() => {
    switch (filter) {
      case "popular":
        return [...searched].sort((a, b) => b.member_count - a.member_count);
      case "ranking":
        return [...searched].sort((a, b) => a.rank_position - b.rank_position);
      case "new":
        return searched; // already newest-first fallback via query order tie-break
      case "fr":
        return searched.filter((c) => c.language === "fr");
      case "international":
        return searched.filter((c) => c.language !== "fr");
      case "games":
      case "development":
      case "creators":
        return searched.filter((c) => c.category === filter);
      case "foryou":
      default:
        return myLang
          ? [...searched].sort((a, b) =>
              a.language === myLang && b.language !== myLang
                ? -1
                : a.language !== myLang && b.language === myLang
                  ? 1
                  : b.member_count - a.member_count,
            )
          : searched;
    }
  })();

  const recommended = filtered.slice(0, 6);
  const ranked = [...all].sort((a, b) => a.rank_position - b.rank_position).slice(0, 10);
  const topActivity = Math.max(1, ...ranked.map((c) => c.activity_points));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <LogoWordmark className="h-7 w-auto" />
        <div className="flex items-center gap-1">
          <button
            aria-label="Rechercher"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            to="/communities/create"
            aria-label="Créer une communauté"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bx-pop relative mt-4 overflow-hidden rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--spark)_16%,var(--card))_0%,var(--card)_55%,color-mix(in_oklab,var(--spark-2)_14%,var(--card))_100%)] p-5">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[color-mix(in_oklab,var(--spark)_35%,transparent)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-[color-mix(in_oklab,var(--spark-2)_30%,transparent)] blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="spark-gradient grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-[0_0_20px_rgba(168,85,247,.55)]">
              <Users className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black">Communautés</h1>
              <p className="text-sm text-muted-foreground">
                Rejoins des communautés qui partagent tes jeux et tes intérêts.
              </p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" /> {all.length.toLocaleString()} communautés
          </span>
          <span className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-500" /> {mine.size.toLocaleString()} rejointes
          </span>
        </div>
        <Link
          to="/communities/create"
          className="spark-gradient relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white shadow-[0_10px_30px_-12px_rgba(168,85,247,.7)] transition active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Créer une communauté
        </Link>
      </div>

      <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-4 shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une communauté..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
              filter === f.id
                ? "spark-gradient text-white shadow-[0_4px_16px_-6px_rgba(168,85,247,.65)]"
                : "border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            <f.icon className="h-3.5 w-3.5" /> {f.label}
          </button>
        ))}
      </div>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Sparkles className="h-4.5 w-4.5 text-primary" /> Recommandées pour toi
          </h2>
        </div>
        {recommended.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {recommended.map((c) => (
              <CommunityCard
                key={c.id}
                community={c}
                joined={mine.has(c.id)}
                onToggleJoin={() => void toggleJoin(c.id, mine.has(c.id))}
                variant="carousel"
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-9">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Trophy className="h-5 w-5 text-amber-500" /> Classement des communautés
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Calculé selon les membres et l'activité des 30 derniers jours.
            </p>
          </div>
        </div>
        {ranked.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-3 space-y-2">
            {ranked.map((c) => (
              <CommunityRowItem
                key={c.id}
                community={c}
                joined={mine.has(c.id)}
                onToggleJoin={() => void toggleJoin(c.id, mine.has(c.id))}
                topActivity={topActivity}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-3 rounded-3xl border border-dashed border-border bg-surface/60 p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl">
        🪐
      </span>
      <p className="mt-3 text-sm text-muted-foreground">
        Aucune communauté pour l'instant.{" "}
        <Link to="/communities/create" className="font-bold text-primary">
          Sois le premier à en créer une !
        </Link>
      </p>
    </div>
  );
}

function CommunityCard({
  community,
  joined,
  onToggleJoin,
  variant,
}: {
  community: CommunityRow;
  joined: boolean;
  onToggleJoin: () => void;
  variant: "carousel" | "row";
}) {
  const rankStyle = RANK_STYLES[community.rank_position];
  return (
    <Link
      to="/communities/$handle"
      params={{ handle: community.handle }}
      className={cn(
        "group block shrink-0 overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
        variant === "carousel" && "w-[17rem]",
      )}
    >
      <div className="relative h-28 w-full bg-gradient-to-br from-primary/40 to-spark-2/30">
        {community.banner_url ? (
          <StoredImage
            path={community.banner_url}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
        {community.rank_position > 0 ? (
          <span
            className={cn(
              "absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black backdrop-blur",
              rankStyle ?? "bg-background/90 text-foreground shadow-sm",
            )}
          >
            {community.rank_position <= 3 ? <Medal className="h-3 w-3" /> : null}#
            {community.rank_position}
          </span>
        ) : null}
      </div>
      <div className="p-3.5">
        <div className="relative z-10 -mt-9 flex items-end gap-2">
          <StoredImage
            path={community.icon_url}
            alt={community.name}
            className="h-14 w-14 shrink-0 rounded-2xl border-[3px] border-card bg-card object-cover shadow-md"
            fallback="🎮"
          />
        </div>
        <p className="mt-2.5 flex items-center gap-1 truncate font-black">
          {community.name}
          {community.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">@{community.handle}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {community.member_count.toLocaleString()} membres
        </p>
        {community.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
            {community.description}
          </p>
        ) : null}
        {community.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {community.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleJoin();
          }}
          className={cn(
            "mt-3 w-full rounded-full py-2.5 text-sm font-black transition active:scale-[0.97]",
            joined
              ? "border border-border text-muted-foreground"
              : "spark-gradient text-white shadow-[0_6px_18px_-8px_rgba(168,85,247,.7)]",
          )}
        >
          {joined ? "Membre ✓" : "+ Rejoindre"}
        </button>
      </div>
    </Link>
  );
}

function CommunityRowItem({
  community,
  joined,
  onToggleJoin,
  topActivity,
}: {
  community: CommunityRow;
  joined: boolean;
  onToggleJoin: () => void;
  topActivity: number;
}) {
  const rankStyle = RANK_STYLES[community.rank_position];
  const activityRatio = Math.min(100, Math.round((community.activity_points / topActivity) * 100));
  return (
    <Link
      to="/communities/$handle"
      params={{ handle: community.handle }}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black",
          rankStyle ?? "bg-primary/10 text-primary",
        )}
      >
        {community.rank_position <= 3 && community.rank_position > 0 ? (
          <Medal className="h-4 w-4" />
        ) : (
          `#${community.rank_position || "-"}`
        )}
      </span>
      <StoredImage
        path={community.icon_url}
        alt={community.name}
        className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-border"
        fallback="🎮"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-black">
          {community.name}
          {community.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {community.member_count.toLocaleString()} membres
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-spark-2"
              style={{ width: `${activityRatio}%` }}
            />
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Activity className="h-3 w-3" /> {community.activity_points.toLocaleString()}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggleJoin();
        }}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition active:scale-[0.97]",
          joined ? "border border-border text-muted-foreground" : "spark-gradient text-white",
        )}
      >
        {joined ? "Membre ✓" : "Rejoindre"}
      </button>
    </Link>
  );
}
