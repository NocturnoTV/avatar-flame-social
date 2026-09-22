import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Trash2, Flag, Link2, Heart, Repeat2, Bookmark, Share } from "lucide-react";
import { toast } from "sonner";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { PostCard, RepostMenuSheet } from "@/components/PostCard";
import { PostVideoPlayer } from "@/components/PostVideoPlayer";
import { PostComposer } from "@/components/PostComposer";
import { Sheet } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { fetchPostThread, type PostRow } from "@/lib/feedPosts";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import { formatCount } from "@/routes/_authenticated/discover.index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/feed/$id")({
  head: () => ({ meta: [{ title: "Post - BloxSpark" }] }),
  component: PostThreadPage,
});

function PostThreadPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    content: string;
    username: string;
    avatarUrl: string | null;
  } | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<typeof replyTarget>(null);
  const [editingPost, setEditingPost] = useState<{ id: string; content: string } | null>(null);
  const [repostMenuFor, setRepostMenuFor] = useState<PostRow | null>(null);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const thread = useQuery({
    queryKey: ["feed-post-thread", id],
    queryFn: () => fetchPostThread(id),
  });

  const repostMenuTargetState = useQuery({
    queryKey: ["feed-post-state", repostMenuFor?.id, user?.id],
    enabled: !!user && !!repostMenuFor,
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_post_reposts")
        .select("post_id")
        .eq("post_id", repostMenuFor!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  if (thread.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  if (!thread.data?.post || thread.data.post.deleted_at) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <BackHeader />
        <p className="py-16 text-center text-sm text-muted-foreground">{t("feedPostUnavailable")}</p>
      </div>
    );
  }

  const { post, quoted, replies, authors, videos } = thread.data;
  const author = authors[post.user_id];
  const username = author?.username ?? "?";

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col pb-[max(4.5rem,env(safe-area-inset-bottom))]">
      <BackHeader />

      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <Link to="/users/$id" params={{ id: username }}>
            <StoredImage
              path={author?.avatar_url}
              alt={username}
              className="h-11 w-11 rounded-full"
              fallback={username[0]?.toUpperCase() ?? "?"}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <Link to="/users/$id" params={{ id: username }} className="truncate font-bold">
                {username}
              </Link>
              {author?.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{username}</p>
          </div>
          <button
            onClick={() => setPostMenuOpen(true)}
            className="shrink-0 p-1 text-muted-foreground"
            aria-label={t("more")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {post.content ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-lg leading-relaxed text-foreground">
            {post.content}
          </p>
        ) : null}

        {post.media.length ? (
          <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-2xl">
            {post.media.slice(0, 4).map((m, i) => (
              <StoredImage key={i} path={m.url} alt={m.alt ?? ""} className="h-40 w-full object-cover" />
            ))}
          </div>
        ) : null}

        {videos[post.id] ? (
          <div className="mt-3">
            <PostVideoPlayer video={videos[post.id]!} className="w-full" />
          </div>
        ) : null}

        {quoted ? (
          <QuotedCard post={quoted} username={authors[quoted.user_id]?.username ?? "?"} avatarUrl={authors[quoted.user_id]?.avatar_url ?? null} />
        ) : null}

        <p className="mt-3 text-sm text-muted-foreground">
          {formatRelativeTime(post.created_at, t)}
          {post.edited_at ? ` · ${t("feedEdited")}` : ""}
        </p>

        <div className="mt-3 flex items-center gap-5 border-y border-border py-3 text-sm">
          <span>
            <b>{formatCount(post.reposts_count)}</b>{" "}
            <span className="text-muted-foreground">{t("repost").toLowerCase()}</span>
          </span>
          <span>
            <b>{formatCount(post.likes_count)}</b>{" "}
            <span className="text-muted-foreground">{t("like").toLowerCase()}</span>
          </span>
        </div>

        <MainPostActions post={post} onReply={() => setReplyTarget({ id: post.id, content: post.content, username, avatarUrl: author?.avatar_url ?? null })} onRepostMenu={() => setRepostMenuFor(post)} />
      </div>

      <button
        onClick={() => setReplyTarget({ id: post.id, content: post.content, username, avatarUrl: author?.avatar_url ?? null })}
        className="flex items-center gap-3 border-b border-border px-4 py-3 text-left text-sm text-muted-foreground"
      >
        <StoredImage path={null} alt="" className="h-9 w-9 rounded-full" fallback="?" />
        {t("feedWriteReply")}
      </button>

      {replies.map((reply) => (
        <PostCard
          key={reply.id}
          post={reply}
          author={authors[reply.user_id]}
          video={videos[reply.id]}
          onOpenThread={() => void navigate({ to: "/feed/$id", params: { id: reply.id } })}
          onReply={() =>
            setReplyTarget({
              id: reply.id,
              content: reply.content,
              username: authors[reply.user_id]?.username ?? "?",
              avatarUrl: authors[reply.user_id]?.avatar_url ?? null,
            })
          }
          onRepostMenu={() => setRepostMenuFor(reply)}
          onEdit={() => setEditingPost({ id: reply.id, content: reply.content })}
          onDeleted={() => void qc.invalidateQueries({ queryKey: ["feed-post-thread", id] })}
        />
      ))}

      {replyTarget ? (
        <PostComposer
          replyTo={replyTarget}
          onClose={() => setReplyTarget(null)}
          onPublished={() => {
            setReplyTarget(null);
            void qc.invalidateQueries({ queryKey: ["feed-post-thread", id] });
          }}
        />
      ) : null}

      {quoteTarget ? (
        <PostComposer
          quoting={quoteTarget}
          onClose={() => setQuoteTarget(null)}
          onPublished={(newId) => {
            setQuoteTarget(null);
            void navigate({ to: "/feed/$id", params: { id: newId } });
          }}
        />
      ) : null}

      {editingPost ? (
        <PostComposer
          editing={editingPost}
          onClose={() => setEditingPost(null)}
          onPublished={() => {
            setEditingPost(null);
            void qc.invalidateQueries({ queryKey: ["feed-post-thread", id] });
          }}
        />
      ) : null}

      {repostMenuFor ? (
        <RepostMenuSheet
          post={repostMenuFor}
          alreadyReposted={!!repostMenuTargetState.data}
          onClose={() => setRepostMenuFor(null)}
          onQuote={() => {
            const target = repostMenuFor;
            setRepostMenuFor(null);
            setQuoteTarget({
              id: target.id,
              content: target.content,
              username: authors[target.user_id]?.username ?? "?",
              avatarUrl: authors[target.user_id]?.avatar_url ?? null,
            });
          }}
        />
      ) : null}

      {postMenuOpen ? (
        <PostThreadMenu
          post={post}
          isMine={user?.id === post.user_id}
          reporting={reporting}
          onReporting={setReporting}
          onClose={() => {
            setPostMenuOpen(false);
            setReporting(false);
          }}
          onEdit={() => {
            setPostMenuOpen(false);
            setEditingPost({ id: post.id, content: post.content });
          }}
          onDeleted={() => void navigate({ to: "/feed" })}
        />
      ) : null}
    </div>
  );
}

function BackHeader() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-10 flex shrink-0 items-center gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
      <Link to="/feed" aria-label={t("back")}>
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <p className="text-base font-black">{t("feedThreadTitle")}</p>
    </header>
  );
}

/** Like/Repost/Bookmark/Share/Reply row for the featured post at the top of
 * its own thread page - a smaller duplicate of PostCard's action bar since
 * the featured post isn't rendered through PostCard (it needs the larger
 * "post en grand" treatment the spec calls for). */
function MainPostActions({
  post,
  onReply,
  onRepostMenu,
}: {
  post: PostRow;
  onReply: () => void;
  onRepostMenu: () => void;
}) {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();

  const state = useQuery({
    queryKey: ["feed-post-state", post.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [liked, bookmarked] = await Promise.all([
        supabase.from("feed_post_likes").select("post_id").eq("post_id", post.id).eq("user_id", user!.id).maybeSingle(),
        supabase.from("feed_post_bookmarks").select("post_id").eq("post_id", post.id).eq("user_id", user!.id).maybeSingle(),
      ]);
      return { liked: !!liked.data, bookmarked: !!bookmarked.data };
    },
  });

  async function toggleLike() {
    if (!user) return;
    const on = !!state.data?.liked;
    qc.setQueryData(["feed-post-state", post.id, user.id], (old: typeof state.data) => (old ? { ...old, liked: !on } : old));
    const result = on
      ? await supabase.from("feed_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("feed_post_likes").insert({ post_id: post.id, user_id: user.id });
    if (result.error) {
      qc.setQueryData(["feed-post-state", post.id, user.id], (old: typeof state.data) => (old ? { ...old, liked: on } : old));
      toast.error(t("errorGeneric"));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["feed-post-thread", post.id] });
  }

  async function toggleBookmark() {
    if (!user) return;
    const on = !!state.data?.bookmarked;
    qc.setQueryData(["feed-post-state", post.id, user.id], (old: typeof state.data) => (old ? { ...old, bookmarked: !on } : old));
    const result = on
      ? await supabase.from("feed_post_bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("feed_post_bookmarks").insert({ post_id: post.id, user_id: user.id });
    if (result.error) {
      qc.setQueryData(["feed-post-state", post.id, user.id], (old: typeof state.data) => (old ? { ...old, bookmarked: on } : old));
      toast.error(t("errorGeneric"));
      return;
    }
    toast.message(on ? t("feedBookmarkRemoved") : t("feedBookmarkAdded"));
  }

  async function share() {
    const url = `${window.location.origin}/feed/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied"));
      }
    } catch {
      // Share sheet dismissed - not an error.
    }
  }

  return (
    <div className="mt-1 flex max-w-sm items-center justify-between text-muted-foreground">
      <button onClick={onReply} className="flex items-center gap-1.5 text-xs font-semibold hover:text-foreground">
        <MessageCircle className="h-4 w-4" /> {post.replies_count > 0 ? formatCount(post.replies_count) : null}
      </button>
      <button onClick={onRepostMenu} className="flex items-center gap-1.5 text-xs font-semibold hover:text-emerald-500">
        <Repeat2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => void toggleLike()}
        className={cn("flex items-center gap-1.5 text-xs font-semibold hover:text-red-500", state.data?.liked && "text-red-500")}
      >
        <Heart className={cn("h-4 w-4", state.data?.liked && "fill-red-500")} />
      </button>
      <button
        onClick={() => void toggleBookmark()}
        className={cn("flex items-center gap-1.5 text-xs font-semibold hover:text-primary", state.data?.bookmarked && "text-primary")}
      >
        <Bookmark className={cn("h-4 w-4", state.data?.bookmarked && "fill-primary")} />
      </button>
      <button onClick={() => void share()} className="flex items-center gap-1.5 text-xs font-semibold hover:text-foreground">
        <Share className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Three-dot menu for the featured post at the top of its own thread page -
 * same options as PostCard's menu, duplicated for the same reason. */
function PostThreadMenu({
  post,
  isMine,
  reporting,
  onReporting,
  onClose,
  onEdit,
  onDeleted,
}: {
  post: PostRow;
  isMine: boolean;
  reporting: boolean;
  onReporting: (v: boolean) => void;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const canStillEdit = isMine && Date.now() - new Date(post.created_at).getTime() < 30 * 60 * 1000;

  const myPin = useQuery({
    queryKey: ["my-pinned-post", user?.id],
    enabled: isMine,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("pinned_feed_post_id").eq("id", user!.id).maybeSingle();
      return data?.pinned_feed_post_id ?? null;
    },
  });
  const isPinnedByMe = myPin.data === post.id;

  async function togglePin() {
    if (!user) return;
    const nextId = isPinnedByMe ? null : post.id;
    const { error } = await supabase.from("profiles").update({ pinned_feed_post_id: nextId }).eq("id", user.id);
    onClose();
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["my-pinned-post", user.id] });
  }

  async function deletePost() {
    const { error } = await supabase.from("feed_posts").update({ deleted_at: new Date().toISOString() }).eq("id", post.id);
    onClose();
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    onDeleted();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/feed/${post.id}`);
    toast.success(t("linkCopied"));
    onClose();
  }

  async function submitReport(reason: string) {
    if (!user) return;
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, post_id: post.id, reason });
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    toast.success(t("reportSubmitted"));
    onClose();
  }

  return (
    <Sheet open onClose={onClose}>
      {reporting ? (
        <div className="space-y-1">
          {(
            [
              { id: "hate", label: t("reportScenarioHate") },
              { id: "violence", label: t("reportScenarioViolence") },
              { id: "nudity", label: t("reportScenarioNudity") },
              { id: "fraud", label: t("reportScenarioFraud") },
              { id: "impersonation", label: t("reportImpersonation") },
              { id: "other", label: t("reportScenarioOther") },
            ] as const
          ).map((reason) => (
            <button
              key={reason.id}
              onClick={() => void submitReport(reason.id)}
              className="flex w-full items-center rounded-2xl px-3 py-3 text-left text-sm font-semibold hover:bg-surface-2"
            >
              {reason.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {isMine && canStillEdit ? (
            <button onClick={onEdit} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2">
              <Pencil className="h-4 w-4" /> {t("feedEditPost")}
            </button>
          ) : null}
          {isMine ? (
            <button onClick={() => void togglePin()} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2">
              {isPinnedByMe ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {isPinnedByMe ? t("feedUnpinPost") : t("feedPinPost")}
            </button>
          ) : null}
          {isMine ? (
            <button onClick={() => void deletePost()} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-destructive hover:bg-surface-2">
              <Trash2 className="h-4 w-4" /> {t("delete")}
            </button>
          ) : (
            <button onClick={() => onReporting(true)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2">
              <Flag className="h-4 w-4" /> {t("videoMenuReport")}
            </button>
          )}
          <button onClick={() => void copyLink()} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2">
            <Link2 className="h-4 w-4" /> {t("copyLink")}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function QuotedCard({
  post,
  username,
  avatarUrl,
}: {
  post: PostRow;
  username: string;
  avatarUrl: string | null;
}) {
  const { t } = useI18n();
  if (post.deleted_at) {
    return (
      <div className="mt-3 rounded-2xl border border-border p-3 text-sm text-muted-foreground">
        {t("feedPostUnavailable")}
      </div>
    );
  }
  return (
    <Link to="/feed/$id" params={{ id: post.id }} className="mt-3 block rounded-2xl border border-border p-3">
      <div className="flex items-center gap-2">
        <StoredImage path={avatarUrl} alt={username} className="h-6 w-6 rounded-full" fallback={username[0]?.toUpperCase() ?? "?"} />
        <span className="text-sm font-bold">@{username}</span>
      </div>
      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{post.content}</p>
    </Link>
  );
}
