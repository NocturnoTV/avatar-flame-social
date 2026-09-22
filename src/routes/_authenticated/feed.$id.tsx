import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { PostCard, RepostMenuSheet } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { fetchPostThread, type PostRow } from "@/lib/feedPosts";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import { formatCount } from "@/routes/_authenticated/discover.index";

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
  const [replyOpen, setReplyOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);

  const thread = useQuery({
    queryKey: ["feed-post-thread", id],
    queryFn: () => fetchPostThread(id),
  });

  const alreadyReposted = useQuery({
    queryKey: ["feed-post-state", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_post_reposts")
        .select("post_id")
        .eq("post_id", id)
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

  const { post, quoted, replies, authors } = thread.data;
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
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <Link to="/users/$id" params={{ id: username }} className="truncate font-bold">
                {username}
              </Link>
              {author?.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{username}</p>
          </div>
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

        {quoted ? (
          <QuotedCard post={quoted} username={authors[quoted.user_id]?.username ?? "?"} avatarUrl={authors[quoted.user_id]?.avatar_url ?? null} />
        ) : null}

        <p className="mt-3 text-sm text-muted-foreground">{formatRelativeTime(post.created_at, t)}</p>

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

        <div className="mt-1 flex max-w-sm items-center justify-between text-muted-foreground">
          <button
            onClick={() => setReplyOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" /> {post.replies_count > 0 ? formatCount(post.replies_count) : null}
          </button>
        </div>
      </div>

      <button
        onClick={() => setReplyOpen(true)}
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
          onOpenThread={() => void navigate({ to: "/feed/$id", params: { id: reply.id } })}
          onReply={() => setReplyOpen(true)}
          onRepostMenu={() => setRepostMenuOpen(true)}
        />
      ))}

      {replyOpen ? (
        <PostComposer
          replyTo={{ id: post.id, content: post.content, username, avatarUrl: author?.avatar_url ?? null }}
          onClose={() => setReplyOpen(false)}
          onPublished={() => {
            setReplyOpen(false);
            void qc.invalidateQueries({ queryKey: ["feed-post-thread", id] });
          }}
        />
      ) : null}

      {quoteOpen ? (
        <PostComposer
          quoting={{ id: post.id, content: post.content, username, avatarUrl: author?.avatar_url ?? null }}
          onClose={() => setQuoteOpen(false)}
          onPublished={(newId) => {
            setQuoteOpen(false);
            void navigate({ to: "/feed/$id", params: { id: newId } });
          }}
        />
      ) : null}

      {repostMenuOpen ? (
        <RepostMenuSheet
          post={post}
          alreadyReposted={!!alreadyReposted.data}
          onClose={() => setRepostMenuOpen(false)}
          onQuote={() => {
            setRepostMenuOpen(false);
            setQuoteOpen(true);
          }}
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
