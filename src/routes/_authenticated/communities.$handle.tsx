import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Hash,
  Heart,
  ImagePlus,
  MessageSquare,
  Pin,
  Send,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { PresenceDot } from "@/components/PresenceDot";
import { Button, Input, Select, Textarea } from "@/components/ui-kit";
import { CommunitySettingsSheet } from "@/components/CommunitySettingsSheet";
import type { CommunityPermission } from "@/lib/communityPermissions";
import { useSession } from "@/lib/session";
import { uploadFile } from "@/lib/media";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/communities/$handle")({
  head: () => ({ meta: [{ title: "Communauté - Bloxspark" }] }),
  component: CommunityPage,
});

const TABS = [
  { id: "channels", label: "Salons" },
  { id: "home", label: "Fil" },
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
  const [tab, setTab] = useState<TabId>("channels");
  const [descExpanded, setDescExpanded] = useState(false);
  const [postText, setPostText] = useState("");
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
    (["manage_community", "manage_channels", "manage_roles", "manage_members", "view_audit_log", "manage_affiliates"] as const).some(
      (p) => myPermissions.data?.has(p),
    );

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
        {canManageAnything ? (
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Paramètres de la communauté"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
          >
            <Settings className="h-5 w-5" />
          </button>
        ) : null}
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
                <p className="mt-1">
                  {c.visibility === "public"
                    ? "Publique"
                    : c.visibility === "private_friends"
                      ? "Privée - amis seulement"
                      : "Privée - sur demande"}
                </p>
              </div>
              {c.rules ? (
                <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                  <p className="mb-2 font-bold">Règles</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{c.rules}</p>
                </div>
              ) : null}
              <AffiliatesDisplay communityId={communityId} />
            </div>
          ) : null}

          {tab === "channels" ? (
            <ChannelsTab communityId={communityId} isMember={isMember} canManageChannels={can("manage_channels")} />
          ) : null}
          {tab === "discussions" ? <DiscussionsTab communityId={communityId} isMember={isMember} /> : null}
          {tab === "players" ? <PlayersTab communityId={communityId} isMember={isMember} /> : null}
          {tab === "events" ? <EventsTab communityId={communityId} isMember={isMember} /> : null}
          {tab === "media" ? <MediaTab communityId={communityId} isMember={isMember} /> : null}
          {tab === "leaderboard" ? <LeaderboardTab communityId={communityId} /> : null}
        </div>
      </div>

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
      const { data } = await supabase.from("communities").select("id,handle,name,icon_url").in("id", ids);
      return data ?? [];
    },
  });
  if (!affiliates.data?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm">
      <p className="mb-2 font-bold">Communautés affiliées</p>
      <div className="flex flex-wrap gap-2">
        {affiliates.data.map((a) => (
          <Link
            key={a.id}
            to="/communities/$handle"
            params={{ handle: a.handle }}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
          >
            <StoredImage path={a.icon_url} alt="" className="h-4 w-4 rounded" fallback="🎮" />
            {a.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

const DISCUSSION_FILTERS = [
  { id: "popular", label: "Populaires" },
  { id: "recent", label: "Récentes" },
  { id: "unanswered", label: "Sans réponse" },
  { id: "featured", label: "À la une" },
] as const;

function DiscussionsTab({
  communityId,
  isMember,
}: {
  communityId: string | undefined;
  isMember: boolean;
}) {
  const { user } = useSession();
  const [filter, setFilter] = useState<(typeof DISCUSSION_FILTERS)[number]["id"]>("popular");
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const threads = useQuery({
    queryKey: ["community-threads", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_threads")
        .select("id,user_id,title,body,featured,replies_count,created_at")
        .eq("community_id", communityId!)
        .order("created_at", { ascending: false });
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({ ...r, author: byId.get(r.user_id) }));
    },
  });

  const replies = useQuery({
    queryKey: ["community-thread-replies", openThread],
    enabled: !!openThread,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_thread_replies")
        .select("id,user_id,content,created_at")
        .eq("thread_id", openThread!)
        .order("created_at");
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({ ...r, author: byId.get(r.user_id) }));
    },
  });

  async function createThread() {
    if (!user || !communityId || !title.trim()) return;
    const { error } = await supabase.from("community_threads").insert({
      community_id: communityId,
      user_id: user.id,
      title: title.trim(),
      body: body.trim() || null,
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setTitle("");
    setBody("");
    setShowNew(false);
    void threads.refetch();
  }

  async function sendReply(threadId: string) {
    if (!user || !replyText.trim()) return;
    const { error } = await supabase.from("community_thread_replies").insert({
      thread_id: threadId,
      user_id: user.id,
      content: replyText.trim(),
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setReplyText("");
    void replies.refetch();
    void threads.refetch();
  }

  const sorted = [...(threads.data ?? [])].sort((a, b) => {
    if (filter === "featured") return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    if (filter === "unanswered") return a.replies_count - b.replies_count;
    if (filter === "popular") return b.replies_count - a.replies_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const filtered =
    filter === "unanswered" ? sorted.filter((t) => t.replies_count === 0) : sorted;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Discussions</h2>
        {isMember ? (
          <button
            onClick={() => setShowNew((v) => !v)}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            + Nouvelle discussion
          </button>
        ) : null}
      </div>

      {showNew ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ton message (optionnel)"
            rows={3}
          />
          <Button size="sm" onClick={() => void createThread()} disabled={!title.trim()}>
            Publier
          </Button>
        </div>
      ) : null}

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {DISCUSSION_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucune discussion.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((thread) => (
            <div key={thread.id} className="rounded-2xl border border-border bg-card p-4">
              <button
                onClick={() => setOpenThread((cur) => (cur === thread.id ? null : thread.id))}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <StoredImage
                    path={thread.author?.avatar_url}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                    fallback="🎮"
                  />
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {thread.author?.username ?? "?"}
                  </p>
                  {thread.featured ? <span className="text-primary">★</span> : null}
                </div>
                <p className="mt-1.5 font-bold">{thread.title}</p>
                {thread.body ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{thread.body}</p>
                ) : null}
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> {thread.replies_count} réponses ·{" "}
                  {new Date(thread.created_at).toLocaleDateString("fr-FR")}
                </p>
              </button>

              {openThread === thread.id ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {(replies.data ?? []).map((r) => (
                    <div key={r.id} className="flex items-start gap-2 text-sm">
                      <StoredImage
                        path={r.author?.avatar_url}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                        fallback="🎮"
                      />
                      <div className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2">
                        <p className="text-xs font-bold">{r.author?.username ?? "?"}</p>
                        <p className="mt-0.5">{r.content}</p>
                      </div>
                    </div>
                  ))}
                  {isMember ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Répondre..."
                        className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm outline-none"
                      />
                      <button
                        onClick={() => void sendReply(thread.id)}
                        disabled={!replyText.trim()}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full spark-gradient text-white disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PLAYERS_NEEDED = ["1", "2", "3+", "team"] as const;
const WHEN_OPTIONS = ["now", "1h", "tonight", "other"] as const;
const MIC_OPTIONS = ["yes", "no", "any"] as const;
const WHEN_LABELS: Record<string, string> = {
  now: "Maintenant",
  "1h": "Dans 1h",
  tonight: "Ce soir",
  other: "Autre",
};
const MIC_LABELS: Record<string, string> = { yes: "Oui", no: "Non", any: "Peu importe" };
const PLAYERS_LABELS: Record<string, string> = {
  "1": "1 joueur",
  "2": "2 joueurs",
  "3+": "3+ joueurs",
  team: "Une équipe",
};

function PlayersTab({
  communityId,
  isMember,
}: {
  communityId: string | undefined;
  isMember: boolean;
}) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [playersNeeded, setPlayersNeeded] = useState<(typeof PLAYERS_NEEDED)[number]>("1");
  const [when, setWhen] = useState<(typeof WHEN_OPTIONS)[number]>("now");
  const [mic, setMic] = useState<(typeof MIC_OPTIONS)[number]>("any");
  const [note, setNote] = useState("");
  const [joining, setJoining] = useState<string | null>(null);

  const myGames = useQuery({
    queryKey: ["my-favorite-game-names", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorite_games").select("name").eq("user_id", user!.id);
      return new Set((data ?? []).map((g) => g.name.toLowerCase()));
    },
  });

  const posts = useQuery({
    queryKey: ["community-lfg", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_lfg_posts")
        .select("id,user_id,players_needed,when_text,mic_pref,note,status,created_at")
        .eq("community_id", communityId!)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const [{ data: people }, { data: games }] = await Promise.all([
        ids.length
          ? supabase
              .from("profiles")
              .select("id,username,avatar_url,last_active_at,show_online_status,dnd")
              .in("id", ids)
          : Promise.resolve({ data: [] }),
        ids.length
          ? supabase.from("favorite_games").select("user_id,name").in("user_id", ids)
          : Promise.resolve({ data: [] }),
      ]);
      const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
      const gamesByUser = new Map<string, string[]>();
      for (const g of games ?? []) (gamesByUser.get(g.user_id) ?? gamesByUser.set(g.user_id, []).get(g.user_id)!).push(g.name);
      return (rows ?? []).map((r) => ({
        ...r,
        author: peopleById.get(r.user_id),
        authorGames: gamesByUser.get(r.user_id) ?? [],
      }));
    },
  });

  async function publish() {
    if (!user || !communityId) return;
    const { error } = await supabase.from("community_lfg_posts").insert({
      community_id: communityId,
      user_id: user.id,
      players_needed: playersNeeded,
      when_text: when,
      mic_pref: mic,
      note: note.trim() || null,
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setNote("");
    toast.success("Recherche publiée !");
    void posts.refetch();
  }

  async function joinPost(targetId: string) {
    if (!user || joining) return;
    setJoining(targetId);
    try {
      const { data: conversationId, error } = await supabase.rpc("start_direct_message", {
        _target: targetId,
      });
      if (error) throw error;
      await navigate({ to: "/messages/$id", params: { id: conversationId as string } });
    } catch (err) {
      toast.error(errorMessage(err, "Une erreur est survenue."));
    } finally {
      setJoining(null);
    }
  }

  const others = (posts.data ?? []).filter((p) => p.user_id !== user?.id);
  const mine = myGames.data ?? new Set<string>();

  return (
    <div className="space-y-5">
      {isMember ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="font-bold">Je cherche des joueurs pour...</p>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nombre de joueurs
            </p>
            <div className="flex flex-wrap gap-2">
              {PLAYERS_NEEDED.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlayersNeeded(p)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                    playersNeeded === p
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground",
                  )}
                >
                  {PLAYERS_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quand ?
            </p>
            <div className="flex flex-wrap gap-2">
              {WHEN_OPTIONS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWhen(w)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                    when === w
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground",
                  )}
                >
                  {WHEN_LABELS[w]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Micro
            </p>
            <div className="flex flex-wrap gap-2">
              {MIC_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMic(m)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                    mic === m
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground",
                  )}
                >
                  {MIC_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Un mot pour les autres ? (optionnel)" />
          <Button className="w-full" onClick={() => void publish()}>
            Publier la recherche
          </Button>
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-bold">Joueurs disponibles</h2>
        {others.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Personne ne cherche de joueurs pour l'instant.
          </p>
        ) : (
          <div className="space-y-2">
            {others.map((p) => {
              const shared = p.authorGames.filter((g) => mine.has(g.toLowerCase())).length;
              const compatibility = Math.min(99, 40 + shared * 15);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <span className="relative shrink-0">
                    <StoredImage
                      path={p.author?.avatar_url}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                      fallback="🎮"
                    />
                    {p.author ? (
                      <PresenceDot profile={p.author} className="absolute bottom-0 right-0 h-3 w-3" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.author?.username ?? "?"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {PLAYERS_LABELS[p.players_needed]} · {WHEN_LABELS[p.when_text]} ·{" "}
                      {p.mic_pref === "yes" ? "🎙️ Micro" : p.mic_pref === "no" ? "Sans micro" : "🎙️ Peu importe"}
                    </p>
                    {p.note ? <p className="truncate text-xs text-muted-foreground">{p.note}</p> : null}
                    {shared > 0 ? (
                      <p className="mt-0.5 text-[11px] font-semibold text-primary">
                        {compatibility}% compatible · {shared} jeu{shared > 1 ? "x" : ""} en commun
                      </p>
                    ) : null}
                  </div>
                  <Button size="sm" disabled={joining === p.user_id} onClick={() => void joinPost(p.user_id)}>
                    {joining === p.user_id ? "..." : "Rejoindre"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EventsTab({
  communityId,
  isMember,
}: {
  communityId: string | undefined;
  isMember: boolean;
}) {
  const { user } = useSession();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");

  const events = useQuery({
    queryKey: ["community-events", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_events")
        .select("id,title,description,starts_at,capacity,tags,created_by")
        .eq("community_id", communityId!)
        .order("starts_at", { ascending: true });
      const ids = (rows ?? []).map((r) => r.id);
      const { data: rsvps } = ids.length
        ? await supabase.from("community_event_rsvps").select("event_id,user_id").in("event_id", ids)
        : { data: [] };
      return (rows ?? []).map((r) => {
        const attendees = (rsvps ?? []).filter((rs) => rs.event_id === r.id);
        return {
          ...r,
          attendeeCount: attendees.length,
          going: !!user && attendees.some((a) => a.user_id === user.id),
        };
      });
    },
  });

  async function createEvent() {
    if (!user || !communityId || !title.trim() || !startsAt) return;
    const { error } = await supabase.from("community_events").insert({
      community_id: communityId,
      created_by: user.id,
      title: title.trim(),
      description: description.trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      capacity: capacity ? Number(capacity) : null,
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setTitle("");
    setDescription("");
    setStartsAt("");
    setCapacity("");
    setShowNew(false);
    void events.refetch();
  }

  async function toggleRsvp(eventId: string, going: boolean) {
    if (!user) return;
    if (going) {
      await supabase.from("community_event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
    } else {
      await supabase.from("community_event_rsvps").insert({ event_id: eventId, user_id: user.id });
    }
    void events.refetch();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Événements à venir</h2>
        {isMember ? (
          <button
            onClick={() => setShowNew((v) => !v)}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            + Événement
          </button>
        ) : null}
      </div>

      {showNew ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'événement" />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnel)"
            rows={3}
          />
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Nombre de places (optionnel)"
          />
          <Button size="sm" onClick={() => void createEvent()} disabled={!title.trim() || !startsAt}>
            Créer l'événement
          </Button>
        </div>
      ) : null}

      {(events.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun événement prévu.</p>
      ) : (
        <div className="space-y-3">
          {(events.data ?? []).map((ev) => (
            <div key={ev.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(ev.starts_at).toLocaleString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <p className="mt-1.5 font-bold">{ev.title}</p>
              {ev.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{ev.description}</p>
              ) : null}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {ev.attendeeCount}
                {ev.capacity ? ` / ${ev.capacity}` : ""} participants
              </p>
              <Button
                size="sm"
                variant={ev.going ? "outline" : "primary"}
                className="mt-3"
                onClick={() => void toggleRsvp(ev.id, ev.going)}
              >
                {ev.going ? "Annuler" : "Participer"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MEDIA_KINDS = [
  { id: "photo", label: "Photos" },
  { id: "video", label: "Vidéos" },
  { id: "clip", label: "Clips" },
  { id: "creation", label: "Créations" },
] as const;

function MediaTab({
  communityId,
  isMember,
}: {
  communityId: string | undefined;
  isMember: boolean;
}) {
  const { user } = useSession();
  const [kind, setKind] = useState<(typeof MEDIA_KINDS)[number]["id"]>("photo");
  const [uploading, setUploading] = useState(false);

  const media = useQuery({
    queryKey: ["community-media", communityId, kind],
    enabled: !!communityId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_media")
        .select("id,user_id,kind,media_url,caption,likes_count,created_at")
        .eq("community_id", communityId!)
        .eq("kind", kind)
        .order("created_at", { ascending: false });
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({ ...r, author: byId.get(r.user_id) }));
    },
  });

  async function upload(file: File) {
    if (!user || !communityId) return;
    setUploading(true);
    try {
      const isVideo = file.type.startsWith("video/");
      const path = await uploadFile(
        "community-media",
        user.id,
        file,
        file.name.split(".").pop() || (isVideo ? "mp4" : "jpg"),
      );
      const { error } = await supabase.from("community_media").insert({
        community_id: communityId,
        user_id: user.id,
        kind,
        media_url: path,
      });
      if (error) throw error;
      void media.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Une erreur est survenue."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {MEDIA_KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                kind === k.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        {isMember ? (
          <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-border text-muted-foreground hover:bg-surface-2">
            <ImagePlus className="h-4 w-4" />
            <input
              type="file"
              accept="image/*,video/*"
              hidden
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>

      {(media.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun média pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(media.data ?? []).map((m) => (
            <div key={m.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              {m.kind === "video" || m.kind === "clip" ? (
                <MediaVideo path={m.media_url} />
              ) : (
                <StoredImage path={m.media_url} alt="" className="aspect-square w-full object-cover" />
              )}
              <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground">
                <span className="truncate">{m.author?.username ?? "?"}</span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {m.likes_count}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaVideo({ path }: { path: string }) {
  const url = useSignedMediaUrl(path);
  return url ? (
    <video src={url} className="aspect-square w-full object-cover" muted loop playsInline controls />
  ) : (
    <div className="aspect-square w-full bg-surface-2" />
  );
}

function useSignedMediaUrl(path: string) {
  const query = useQuery({
    queryKey: ["signed-media", path],
    queryFn: async () => {
      const [bucket = "community-media", ...rest] = path.split("/");
      const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 3600);
      return data?.signedUrl ?? null;
    },
  });
  return query.data ?? null;
}

const LEADERBOARD_FILTERS = [
  { id: "week", label: "Cette semaine" },
  { id: "month", label: "Ce mois-ci" },
  { id: "all", label: "Toujours" },
] as const;

const XP_REASONS: { key: string; icon: string; label: string; amount: number }[] = [
  { key: "reply", icon: "💬", label: "Participer aux discussions", amount: 10 },
  { key: "post", icon: "📝", label: "Créer une publication", amount: 15 },
  { key: "thread", icon: "💬", label: "Lancer une discussion", amount: 15 },
  { key: "event_rsvp", icon: "📅", label: "Participer à un événement", amount: 25 },
];

function LeaderboardTab({ communityId }: { communityId: string | undefined }) {
  const [filter, setFilter] = useState<(typeof LEADERBOARD_FILTERS)[number]["id"]>("all");

  const since = (() => {
    if (filter === "week") return new Date(Date.now() - 7 * 86_400_000).toISOString();
    if (filter === "month") return new Date(Date.now() - 30 * 86_400_000).toISOString();
    return null;
  })();

  const leaderboard = useQuery({
    queryKey: ["community-leaderboard", communityId, filter],
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
      const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
      const ids = ranked.map(([id]) => id);
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return ranked.map(([id, xp]) => ({ id, xp, author: byId.get(id) }));
    },
  });

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Membres les plus actifs</h2>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {LEADERBOARD_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground",
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
          <div className="mt-3 space-y-1.5">
            {(leaderboard.data ?? []).map((row, i) => (
              <Link
                key={row.id}
                to="/users/$id"
                params={{ id: row.author?.username ?? row.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <span className="w-7 shrink-0 text-center text-lg">{medals[i] ?? `#${i + 1}`}</span>
                <StoredImage
                  path={row.author?.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  fallback="🎮"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.author?.username ?? "?"}</p>
                  <p className="text-xs text-muted-foreground">{row.xp.toLocaleString()} XP</p>
                </div>
                <Trophy className="h-4 w-4 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-bold">Comment gagner de l'XP ?</p>
        <div className="mt-3 space-y-2">
          {XP_REASONS.map((r) => (
            <div key={r.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span>{r.icon}</span> {r.label}
              </span>
              <span className="font-bold text-primary">+{r.amount} XP</span>
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

function ChannelsTab({
  communityId,
  isMember,
  canManageChannels,
}: {
  communityId: string | undefined;
  isMember: boolean;
  canManageChannels: boolean;
}) {
  const { user } = useSession();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
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

  const activeChannel = activeChannelId ?? channels.data?.find((c) => c.is_default)?.id ?? channels.data?.[0]?.id;

  const messages = useQuery({
    queryKey: ["community-channel-messages", activeChannel],
    enabled: !!activeChannel,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_channel_messages")
        .select("id,user_id,content,created_at")
        .eq("channel_id", activeChannel!)
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
    if (!user || !activeChannel || !communityId || !text.trim()) return;
    const { error } = await supabase.from("community_channel_messages").insert({
      channel_id: activeChannel,
      community_id: communityId,
      user_id: user.id,
      content: text.trim(),
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setText("");
    void messages.refetch();
  }

  async function createChannel() {
    if (!communityId || !newChannelName.trim()) return;
    const { error } = await supabase.rpc("community_create_channel", {
      _community: communityId,
      _category: null,
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

  const uncategorized = (channels.data ?? []).filter((c) => !c.category_id);
  const byCategory = (categories.data ?? []).map((cat) => ({
    ...cat,
    channels: (channels.data ?? []).filter((c) => c.category_id === cat.id),
  }));

  return (
    <div className="flex gap-3">
      <div className="w-44 shrink-0 space-y-3">
        {uncategorized.length ? (
          <div className="space-y-0.5">
            {uncategorized.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannelId(ch.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition",
                  activeChannel === ch.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-2",
                )}
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
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition",
                    activeChannel === ch.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-2",
                  )}
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
              className="w-full rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground hover:bg-surface-2"
            >
              + Nouveau salon
            </button>
          )
        ) : null}
      </div>

      <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card">
        <div className="flex h-80 flex-col-reverse overflow-y-auto p-3">
          <div>
            {(messages.data ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun message dans ce salon pour l'instant.
              </p>
            ) : (
              <div className="space-y-2">
                {(messages.data ?? []).map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <StoredImage
                      path={m.author?.avatar_url}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                      fallback="🎮"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold">{m.author?.username ?? "?"}</span>
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
          <div className="flex items-center gap-2 border-t border-border p-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              placeholder="Écrire un message..."
              className="min-w-0 flex-1 rounded-full bg-surface px-3.5 py-2 text-sm outline-none"
            />
            <button
              onClick={() => void send()}
              disabled={!text.trim()}
              aria-label="Envoyer"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full spark-gradient text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
