import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { StoredImage } from "@/components/Media";
import { PostCard, RepostMenuSheet } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { fetchFeed, feedKey, type PostRow } from "@/lib/feedPosts";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/feed/")({
  head: () => ({
    meta: [
      { title: "Feed - BloxSpark" },
      {
        name: "description",
        content: "La place publique de BloxSpark : posts, réponses et republications.",
      },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const { user } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    content: string;
    username: string;
    avatarUrl: string | null;
  } | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<typeof replyTarget>(null);
  const [editingPost, setEditingPost] = useState<{ id: string; content: string } | null>(null);
  const [repostMenuFor, setRepostMenuFor] = useState<PostRow | null>(null);
  const [seenAt, setSeenAt] = useState(() => new Date().toISOString());
  const listRef = useRef<HTMLDivElement>(null);

  const me = useQuery({
    queryKey: ["feed-header-me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url,username")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const following = useQuery({
    queryKey: ["feed-following", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      return (data ?? []).map((f) => f.following_id);
    },
  });

  const feed = useQuery({
    queryKey: feedKey(user?.id, tab, following.data),
    enabled: !!user && following.data !== undefined,
    queryFn: () => fetchFeed({ userId: user!.id, tab, followingIds: following.data ?? [] }),
  });

  const newPostsCheck = useQuery({
    queryKey: ["feed-new-posts", tab, seenAt],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const { count } = await supabase
        .from("feed_posts")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("reply_to_id", null)
        .gt("created_at", seenAt);
      return count ?? 0;
    },
  });

  function switchTab(next: "foryou" | "following") {
    if (next === tab) {
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      void feed.refetch();
      setSeenAt(new Date().toISOString());
      return;
    }
    setTab(next);
    listRef.current?.scrollTo({ top: 0 });
  }

  function loadNewPosts() {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    void feed.refetch();
    setSeenAt(new Date().toISOString());
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col pb-[max(4.5rem,env(safe-area-inset-bottom))]">
      <header className="z-10 flex shrink-0 items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
        <Link to="/profile">
          <StoredImage
            path={me.data?.avatar_url}
            alt={me.data?.username ?? ""}
            className="h-8 w-8 rounded-full"
            fallback={me.data?.username?.[0]?.toUpperCase() ?? "?"}
          />
        </Link>
        <p className="text-base font-black">{t("feedTitle")}</p>
        <span className="h-8 w-8" />
      </header>

      <div className="flex shrink-0 border-b border-border">
        {(["foryou", "following"] as const).map((value) => (
          <button
            key={value}
            onClick={() => switchTab(value)}
            className={cn(
              "flex-1 border-b-2 py-3 text-sm font-bold transition",
              tab === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {value === "foryou" ? t("feedTabForYou") : t("feedTabFollowing")}
          </button>
        ))}
      </div>

      <div ref={listRef} className="relative flex-1 overflow-y-auto">
        {newPostsCheck.data && newPostsCheck.data > 0 ? (
          <button
            onClick={loadNewPosts}
            className="sticky top-2 z-10 mx-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg"
          >
            {t("feedNewPosts", { count: newPostsCheck.data })}
          </button>
        ) : null}

        {feed.isLoading ? (
          <div className="space-y-4 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-11 w-11 rounded-full bg-surface-2" />
                  <div className="h-3 w-32 rounded bg-surface-2" />
                </div>
                <div className="h-3 w-full rounded bg-surface-2" />
                <div className="h-3 w-2/3 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        ) : feed.data?.posts.length ? (
          feed.data.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={feed.data.authors[post.user_id]}
              onOpenThread={() => void navigate({ to: "/feed/$id", params: { id: post.id } })}
              onReply={() =>
                setReplyTarget({
                  id: post.id,
                  content: post.content,
                  username: feed.data.authors[post.user_id]?.username ?? "?",
                  avatarUrl: feed.data.authors[post.user_id]?.avatar_url ?? null,
                })
              }
              onRepostMenu={() => setRepostMenuFor(post)}
              onEdit={() => setEditingPost({ id: post.id, content: post.content })}
            />
          ))
        ) : tab === "following" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-lg font-black">{t("feedEmptyFollowingTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("feedEmptyFollowingSubtitle")}</p>
            <Link
              to="/discover"
              className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              {t("feedDiscoverAccounts")}
            </Link>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("feedEmptyForYou")}</p>
        )}
      </div>

      <button
        onClick={() => setComposerOpen(true)}
        aria-label={t("feedComposerOpen")}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 lg:right-[max(2rem,calc(50%-360px))]"
      >
        <Plus className="h-6 w-6" />
      </button>

      {composerOpen ? (
        <PostComposer
          onClose={() => setComposerOpen(false)}
          onPublished={() => {
            setComposerOpen(false);
            void qc.invalidateQueries({ queryKey: ["feed-posts"] });
          }}
        />
      ) : null}

      {replyTarget ? (
        <PostComposer
          replyTo={replyTarget}
          onClose={() => setReplyTarget(null)}
          onPublished={(id) => {
            setReplyTarget(null);
            void navigate({ to: "/feed/$id", params: { id } });
          }}
        />
      ) : null}

      {quoteTarget ? (
        <PostComposer
          quoting={quoteTarget}
          onClose={() => setQuoteTarget(null)}
          onPublished={(id) => {
            setQuoteTarget(null);
            void navigate({ to: "/feed/$id", params: { id } });
          }}
        />
      ) : null}

      {editingPost ? (
        <PostComposer
          editing={editingPost}
          onClose={() => setEditingPost(null)}
          onPublished={() => setEditingPost(null)}
        />
      ) : null}

      {repostMenuFor ? (
        <RepostMenuSheetWrapper
          post={repostMenuFor}
          onClose={() => setRepostMenuFor(null)}
          onQuote={() => {
            const author = feed.data?.authors[repostMenuFor.user_id];
            setQuoteTarget({
              id: repostMenuFor.id,
              content: repostMenuFor.content,
              username: author?.username ?? "?",
              avatarUrl: author?.avatar_url ?? null,
            });
            setRepostMenuFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function RepostMenuSheetWrapper({
  post,
  onClose,
  onQuote,
}: {
  post: PostRow;
  onClose: () => void;
  onQuote: () => void;
}) {
  const { user } = useSession();
  const alreadyReposted = useQuery({
    queryKey: ["feed-post-state", post.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("feed_post_reposts")
        .select("post_id")
        .eq("post_id", post.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });
  return (
    <RepostMenuSheet post={post} alreadyReposted={!!alreadyReposted.data} onClose={onClose} onQuote={onQuote} />
  );
}
