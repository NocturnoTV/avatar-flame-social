import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Heart, Pin, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { Button } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/communities/$handle")({
  head: () => ({ meta: [{ title: "Communauté — Bloxspark" }] }),
  component: CommunityPage,
});

const TABS = [
  { id: "home", label: "Accueil" },
  { id: "discussions", label: "Discussions" },
  { id: "players", label: "Joueurs" },
  { id: "events", label: "Événements" },
  { id: "media", label: "Médias" },
  { id: "leaderboard", label: "Classement" },
  { id: "about", label: "À propos" },
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

function CommunityPage() {
  const { handle } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("home");
  const [descExpanded, setDescExpanded] = useState(false);
  const [postText, setPostText] = useState("");

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

  async function toggleJoin() {
    if (!user || !communityId) return;
    if (isMember) {
      await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", user.id);
    } else {
      await supabase.from("community_members").insert({ community_id: communityId, user_id: user.id });
    }
    void membership.refetch();
    void community.refetch();
  }

  const posts = useQuery({
    queryKey: ["community-posts", communityId],
    enabled: !!communityId && tab === "home",
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_posts")
        .select("id,user_id,content,pinned,likes_count,comments_count,created_at")
        .eq("community_id", communityId!)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const { data: likes } = user
        ? await supabase
            .from("community_post_likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", (rows ?? []).map((r) => r.id))
        : { data: [] };
      const likedIds = new Set((likes ?? []).map((l) => l.post_id));
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({
        ...r,
        author: byId.get(r.user_id),
        liked: likedIds.has(r.id),
      }));
    },
  });

  async function publishPost() {
    if (!user || !communityId || !postText.trim()) return;
    const { error } = await supabase.from("community_posts").insert({
      community_id: communityId,
      user_id: user.id,
      content: postText.trim(),
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setPostText("");
    void posts.refetch();
  }

  async function toggleLike(postId: string, liked: boolean) {
    if (!user) return;
    if (liked) {
      await supabase.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("community_post_likes").insert({ post_id: postId, user_id: user.id });
    }
    void posts.refetch();
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

  const description = c.description ?? "";
  const shortDescription = description.length > 140 ? `${description.slice(0, 140)}…` : description;

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/40 to-spark-2/30 sm:h-48">
        {c.banner_url ? (
          <StoredImage path={c.banner_url} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <Link
          to="/communities"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <StoredImage
            path={c.icon_url}
            alt={c.name}
            className="h-20 w-20 shrink-0 rounded-3xl border-4 border-background object-cover"
            fallback="🎮"
          />
          {user ? (
            <Button
              variant={isMember ? "outline" : "primary"}
              onClick={() => void toggleJoin()}
              className="mb-1"
            >
              {isMember ? "Membre ✓" : "+ Rejoindre"}
            </Button>
          ) : null}
        </div>

        <h1 className="mt-3 flex items-center gap-1.5 text-2xl font-black">
          {c.name}
          {c.verified ? <span className="text-primary">✓</span> : null}
        </h1>
        <p className="text-sm text-muted-foreground">@{c.handle}</p>
        <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{c.member_count.toLocaleString()} membres</span>
        </p>

        {description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {descExpanded ? description : shortDescription}
            {description.length > 140 ? (
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="ml-1 font-semibold text-primary"
              >
                {descExpanded ? "Voir moins" : "Voir plus"}
              </button>
            ) : null}
          </p>
        ) : null}

        {c.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto border-b border-border pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "home" ? (
            <div className="space-y-3">
              {isMember ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
                  <input
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Partage quelque chose avec la communauté..."
                    className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                  />
                  <button
                    onClick={() => void publishPost()}
                    disabled={!postText.trim()}
                    aria-label="Publier"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full spark-gradient text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {(posts.data ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucune publication pour l'instant.
                </p>
              ) : (
                (posts.data ?? []).map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                    {p.pinned ? (
                      <p className="mb-2 flex items-center gap-1 text-xs font-bold text-primary">
                        <Pin className="h-3 w-3" /> Publication épinglée
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <StoredImage
                        path={p.author?.avatar_url}
                        alt={p.author?.username ?? ""}
                        className="h-9 w-9 rounded-full object-cover"
                        fallback="🎮"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p.author?.username ?? "?"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
                    <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                      <button
                        onClick={() => void toggleLike(p.id, p.liked)}
                        className={cn(
                          "flex items-center gap-1.5 font-semibold",
                          p.liked && "text-red-500",
                        )}
                      >
                        <Heart className="h-4 w-4" fill={p.liked ? "currentColor" : "none"} />
                        {p.likes_count}
                      </button>
                      <span className="flex items-center gap-1.5">💬 {p.comments_count}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "about" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Créée le
                </p>
                <p className="mt-1">{new Date(c.created_at).toLocaleDateString("fr-FR")}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Langue
                </p>
                <p className="mt-1">{c.language.toUpperCase()}</p>
                {c.game_name ? (
                  <>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Jeu associé
                    </p>
                    <p className="mt-1">{c.game_name}</p>
                  </>
                ) : null}
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Catégorie
                </p>
                <p className="mt-1">{CATEGORY_LABELS[c.category] ?? c.category}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Type
                </p>
                <p className="mt-1">{c.visibility === "public" ? "Publique" : "Privée"}</p>
              </div>
              {c.rules ? (
                <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                  <p className="mb-2 font-bold">Règles</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{c.rules}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab !== "home" && tab !== "about" ? <ComingSoon /> : null}
        </div>
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      Bientôt disponible.
    </div>
  );
}
