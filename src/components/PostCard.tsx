import { useState, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Repeat2, Bookmark, Share, MoreHorizontal, Flag, Trash2, Link2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { Sheet } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import { formatCount } from "@/routes/_authenticated/discover.index";
import { cn } from "@/lib/utils";
import type { PostAuthor, PostRow } from "@/lib/feedPosts";

function PostText({ content }: { content: string }) {
  const parts = content.split(/(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          return (
            <Link
              key={i}
              to="/users/$id"
              params={{ id: part.slice(1) }}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-primary"
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith("#")) {
          return (
            <span key={i} className="font-semibold text-primary">
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}

function mediaGridClass(count: number) {
  if (count === 1) return "grid-cols-1";
  if (count === 3) return "grid-cols-2 [&>*:first-child]:row-span-2";
  return "grid-cols-2";
}

export function PostCard({
  post,
  author,
  onOpenThread,
  onReply,
  onRepostMenu,
  onDeleted,
}: {
  post: PostRow;
  author: PostAuthor | undefined;
  onOpenThread: () => void;
  onReply: () => void;
  onRepostMenu: () => void;
  onDeleted?: () => void;
}) {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const isMine = user?.id === post.user_id;
  const username = author?.username ?? "?";
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/feed/${post.id}`);
    toast.success(t("linkCopied"));
    setMenuOpen(false);
  }

  async function deletePost() {
    const { error } = await supabase.from("feed_posts").update({ deleted_at: new Date().toISOString() }).eq("id", post.id);
    setMenuOpen(false);
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["feed-posts"] });
    onDeleted?.();
  }

  async function submitReport(reason: string) {
    if (!user) return;
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, post_id: post.id, reason });
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    toast.success(t("reportSubmitted"));
    setReporting(false);
    setMenuOpen(false);
  }

  const state = useQuery({
    queryKey: ["feed-post-state", post.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [liked, reposted, bookmarked] = await Promise.all([
        supabase.from("feed_post_likes").select("post_id").eq("post_id", post.id).eq("user_id", user!.id).maybeSingle(),
        supabase.from("feed_post_reposts").select("post_id").eq("post_id", post.id).eq("user_id", user!.id).maybeSingle(),
        supabase.from("feed_post_bookmarks").select("post_id").eq("post_id", post.id).eq("user_id", user!.id).maybeSingle(),
      ]);
      return { liked: !!liked.data, reposted: !!reposted.data, bookmarked: !!bookmarked.data };
    },
  });

  function patchCount(field: "likes_count" | "reposts_count", delta: number) {
    qc.setQueriesData({ queryKey: ["feed-posts"] }, (old: { posts: PostRow[]; authors: unknown } | undefined) => {
      if (!old?.posts) return old;
      return { ...old, posts: old.posts.map((p) => (p.id === post.id ? { ...p, [field]: Math.max(0, p[field] + delta) } : p)) };
    });
  }

  async function toggleLike() {
    if (!user) return;
    const on = !!state.data?.liked;
    qc.setQueryData(["feed-post-state", post.id, user.id], (old: typeof state.data) => (old ? { ...old, liked: !on } : old));
    patchCount("likes_count", on ? -1 : 1);
    const result = on
      ? await supabase.from("feed_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("feed_post_likes").insert({ post_id: post.id, user_id: user.id });
    if (result.error) {
      qc.setQueryData(["feed-post-state", post.id, user.id], (old: typeof state.data) => (old ? { ...old, liked: on } : old));
      patchCount("likes_count", on ? 1 : -1);
      toast.error(t("errorGeneric"));
    }
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
    <>
    <article
      onClick={onOpenThread}
      className="cursor-pointer border-b border-border px-4 py-3 transition hover:bg-surface-2/60"
    >
      <div className="flex gap-3">
        <Link to="/users/$id" params={{ id: username }} onClick={(e) => e.stopPropagation()}>
          <StoredImage
            path={author?.avatar_url}
            alt={username}
            className="h-11 w-11 shrink-0 rounded-full"
            fallback={username[0]?.toUpperCase() ?? "?"}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <Link
              to="/users/$id"
              params={{ id: username }}
              onClick={(e) => e.stopPropagation()}
              className="truncate font-bold text-foreground"
            >
              {username}
            </Link>
            {author?.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="shrink-0 text-muted-foreground">@{username}</span>
            <span className="shrink-0 text-muted-foreground">·</span>
            <span className="shrink-0 text-muted-foreground">{formatRelativeTime(post.created_at, t)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(true);
              }}
              className="ml-auto shrink-0 p-1 text-muted-foreground"
              aria-label={t("more")}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {post.content ? <PostText content={post.content} /> : null}

          {post.media.length ? (
            <div className={cn("mt-2 grid gap-1 overflow-hidden rounded-2xl", mediaGridClass(post.media.length))}>
              {post.media.slice(0, 4).map((m, i) => (
                <StoredImage
                  key={i}
                  path={m.url}
                  alt={m.alt ?? ""}
                  className="h-full max-h-72 w-full object-cover"
                />
              ))}
            </div>
          ) : null}

          <div className="mt-2.5 flex max-w-sm items-center justify-between text-muted-foreground">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReply();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              {post.replies_count > 0 ? formatCount(post.replies_count) : null}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRepostMenu();
              }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold hover:text-emerald-500",
                state.data?.reposted && "text-emerald-500",
              )}
            >
              <Repeat2 className="h-4 w-4" />
              {post.reposts_count > 0 ? formatCount(post.reposts_count) : null}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void toggleLike();
              }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold hover:text-red-500",
                state.data?.liked && "text-red-500",
              )}
            >
              <Heart className={cn("h-4 w-4", state.data?.liked && "fill-red-500")} />
              {post.likes_count > 0 ? formatCount(post.likes_count) : null}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void toggleBookmark();
              }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold hover:text-primary",
                state.data?.bookmarked && "text-primary",
              )}
            >
              <Bookmark className={cn("h-4 w-4", state.data?.bookmarked && "fill-primary")} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void share();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold hover:text-foreground"
            >
              <Share className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
    <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
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
          {isMine ? (
            <button
              onClick={() => void deletePost()}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-destructive hover:bg-surface-2"
            >
              <Trash2 className="h-4 w-4" /> {t("delete")}
            </button>
          ) : (
            <button
              onClick={() => setReporting(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
            >
              <Flag className="h-4 w-4" /> {t("videoMenuReport")}
            </button>
          )}
          <button
            onClick={() => void copyLink()}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
          >
            <Link2 className="h-4 w-4" /> {t("copyLink")}
          </button>
          {!isMine ? (
            <button
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
            >
              <EyeOff className="h-4 w-4" /> {t("notInterested")}
            </button>
          ) : null}
        </div>
      )}
    </Sheet>
    </>
  );
}

/** Repost/Quote/Cancel menu opened from a post's Repost action. */
export function RepostMenuSheet({
  post,
  alreadyReposted,
  onClose,
  onQuote,
}: {
  post: PostRow;
  alreadyReposted: boolean;
  onClose: () => void;
  onQuote: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();

  async function toggleRepost() {
    if (!user) return;
    const result = alreadyReposted
      ? await supabase.from("feed_post_reposts").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("feed_post_reposts").insert({ post_id: post.id, user_id: user.id });
    onClose();
    if (result.error) {
      toast.error(t("errorGeneric"));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["feed-posts"] });
    void qc.invalidateQueries({ queryKey: ["feed-post-state", post.id] });
    toast.success(alreadyReposted ? t("undoRepost") : t("repostSuccess"));
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="space-y-1">
        <button
          onClick={() => void toggleRepost()}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
        >
          <Repeat2 className="h-4 w-4" />
          <span className="text-sm font-semibold">
            {alreadyReposted ? t("undoRepost") : t("repost")}
          </span>
        </button>
        {!alreadyReposted ? (
          <button
            onClick={onQuote}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">{t("feedQuote")}</span>
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
