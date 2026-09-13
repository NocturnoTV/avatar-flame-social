import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { LogoWordmark } from "@/components/Logo";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/communities/")({
  head: () => ({
    meta: [
      { title: "Communautés — Bloxspark" },
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
};

const CATEGORY_FILTERS: { id: string; label: string }[] = [
  { id: "foryou", label: "Pour toi" },
  { id: "popular", label: "Populaires" },
  { id: "new", label: "Nouvelles" },
  { id: "games", label: "Jeux" },
  { id: "development", label: "Développement" },
  { id: "creators", label: "Créateurs" },
  { id: "fr", label: "FR" },
  { id: "international", label: "International" },
];

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
      const { data, error } = await supabase
        .from("communities")
        .select(
          "id,handle,name,description,category,language,banner_url,icon_url,tags,verified,member_count",
        )
        .eq("visibility", "public")
        .order("member_count", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
  const popular = [...all].sort((a, b) => b.member_count - a.member_count).slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <LogoWordmark className="h-7 w-auto" />
        <div className="flex items-center gap-1">
          <button
            aria-label="Rechercher"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            to="/communities/create"
            aria-label="Créer une communauté"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="spark-gradient grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-[0_0_16px_rgba(168,85,247,.5)]">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-black">Communautés</h1>
            <p className="text-sm text-muted-foreground">
              Rejoins des communautés qui partagent tes jeux et tes intérêts.
            </p>
          </div>
        </div>
        <Link
          to="/communities/create"
          className="spark-gradient shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold text-white shadow-[0_0_14px_rgba(168,85,247,.45)]"
        >
          + Créer
        </Link>
      </div>

      <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-4">
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
              "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Recommandées pour toi</h2>
        </div>
        {recommended.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
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

      <section className="mt-8">
        <h2 className="text-lg font-bold">Communautés populaires</h2>
        {popular.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-3 space-y-2">
            {popular.map((c) => (
              <CommunityRowItem
                key={c.id}
                community={c}
                joined={mine.has(c.id)}
                onToggleJoin={() => void toggleJoin(c.id, mine.has(c.id))}
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
    <div className="mt-3 rounded-3xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      Aucune communauté pour l'instant.{" "}
      <Link to="/communities/create" className="font-semibold text-primary">
        Sois le premier à en créer une !
      </Link>
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
  return (
    <Link
      to="/communities/$handle"
      params={{ handle: community.handle }}
      className={cn(
        "block shrink-0 overflow-hidden rounded-3xl border border-border bg-card",
        variant === "carousel" && "w-72",
      )}
    >
      <div className="relative h-24 w-full bg-gradient-to-br from-primary/40 to-spark-2/30">
        {community.banner_url ? (
          <StoredImage path={community.banner_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="p-3">
        <div className="-mt-8 flex items-end gap-2">
          <StoredImage
            path={community.icon_url}
            alt={community.name}
            className="h-12 w-12 shrink-0 rounded-2xl border-2 border-card object-cover"
            fallback="🎮"
          />
        </div>
        <p className="mt-2 flex items-center gap-1 truncate font-bold">
          {community.name}
          {community.verified ? <span className="text-primary">✓</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">@{community.handle}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {community.member_count.toLocaleString()} membres
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
                {tag}
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
            "mt-3 w-full rounded-full py-2 text-sm font-bold transition",
            joined ? "border border-border text-muted-foreground" : "spark-gradient text-white",
          )}
        >
          {joined ? "Membre ✓" : "Rejoindre"}
        </button>
      </div>
    </Link>
  );
}

function CommunityRowItem({
  community,
  joined,
  onToggleJoin,
}: {
  community: CommunityRow;
  joined: boolean;
  onToggleJoin: () => void;
}) {
  return (
    <Link
      to="/communities/$handle"
      params={{ handle: community.handle }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
    >
      <StoredImage
        path={community.icon_url}
        alt={community.name}
        className="h-12 w-12 shrink-0 rounded-2xl object-cover"
        fallback="🎮"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-bold">
          {community.name}
          {community.verified ? <span className="text-primary">✓</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {community.member_count.toLocaleString()} membres
        </p>
        {community.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {community.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggleJoin();
        }}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition",
          joined ? "border border-border text-muted-foreground" : "spark-gradient text-white",
        )}
      >
        {joined ? "Membre ✓" : "Rejoindre"}
      </button>
    </Link>
  );
}
