import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Heart, ImagePlus, MessageCircle, Repeat2, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { LogoWordmark } from "@/components/Logo";
import { Sheet } from "@/components/ui-kit";
import { Verified } from "@/components/Verified";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { uploadFile } from "@/lib/media";
import { cn, errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "Actualités — Bloxspark" },
      {
        name: "description",
        content: "Ce que la communauté BloxSpark partage en ce moment.",
      },
    ],
  }),
  component: NewsPage,
});

const POST_MAX = 500;
const REPLY_MAX = 300;

type Author = { id: string; username: string | null; avatar_url: string | null; verified: boolean | null };
type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  replies_count: number;
  reposts_count: number;
  created_at: string;
  author: Author | undefined;
  liked: boolean;
  reposted: boolean;
};

function timeAgo(value: string, lang: string) {
  const elapsed = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(elapsed);
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (absolute < 60_000) return formatter.format(Math.round(elapsed / 1000), "second");
  if (absolute < 3_600_000) return formatter.format(Math.round(elapsed / 60_000), "minute");
  if (absolute < 86_400_000) return formatter.format(Math.round(elapsed / 3_600_000), "hour");
  if (absolute < 604_800_000) return formatter.format(Math.round(elapsed / 86_400_000), "day");
  return new Date(value).toLocaleDateString(lang, { day: "numeric", month: "short" });
}

function NewsPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [draftImage, setDraftImage] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [openReplies, setOpenReplies] = useState<Post | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const myProfile = useQuery({
    queryKey: ["news-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const posts = useQuery({
    queryKey: ["feed-posts"],
    enabled: !!user,
    queryFn: async (): Promise<Post[]> => {
      const { data: rows, error } = await supabase
        .from("feed_posts")
        .select("id,user_id,content,image_url,likes_count,replies_count,reposts_count,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const postIds = (rows ?? []).map((r) => r.id);
      const [{ data: authors }, { data: myLikes }, { data: myReposts }] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("id,username,avatar_url,verified").in("id", ids)
          : Promise.resolve({ data: [] as Author[] }),
        postIds.length
          ? supabase.from("feed_post_likes").select("post_id").eq("user_id", user!.id).in("post_id", postIds)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
        postIds.length
          ? supabase.from("feed_post_reposts").select("post_id").eq("user_id", user!.id).in("post_id", postIds)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);
      const authorsById = new Map((authors ?? []).map((a) => [a.id, a]));
      const likedSet = new Set((myLikes ?? []).map((l) => l.post_id));
      const repostedSet = new Set((myReposts ?? []).map((r) => r.post_id));
      return (rows ?? []).map((r) => ({
        ...r,
        author: authorsById.get(r.user_id),
        liked: likedSet.has(r.id),
        reposted: repostedSet.has(r.id),
      }));
    },
  });

  async function publish() {
    if (!user || !draft.trim()) return;
    setPosting(true);
    try {
      let imagePath: string | null = null;
      if (draftImage) {
        imagePath = await uploadFile("feed-posts", user.id, draftImage, draftImage.name.split(".").pop() ?? "jpg");
      }
      const { error } = await supabase.from("feed_posts").insert({
        user_id: user.id,
        content: draft.trim(),
        image_url: imagePath,
      });
      if (error) throw error;
      setDraft("");
      setDraftImage(null);
      void posts.refetch();
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: Post) {
    if (!user) return;
    if (post.liked) {
      await supabase.from("feed_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("feed_post_likes").insert({ post_id: post.id, user_id: user.id });
    }
    void posts.refetch();
  }

  async function toggleRepost(post: Post) {
    if (!user) return;
    if (post.reposted) {
      await supabase.from("feed_post_reposts").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("feed_post_reposts").insert({ post_id: post.id, user_id: user.id });
      toast.success(t("newsReposted"));
    }
    void posts.refetch();
  }

  async function deletePost(post: Post) {
    await supabase.from("feed_posts").delete().eq("id", post.id);
    void posts.refetch();
    void qc.invalidateQueries({ queryKey: ["feed-posts"] });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <LogoWordmark className="h-7 w-auto" />
        <h1 className="text-lg font-black">{t("newsFeedTitle")}</h1>
      </header>

      <div className="mt-5 flex gap-3 border-b border-border pb-5">
        <StoredImage
          path={myProfile.data?.avatar_url}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full object-cover"
          fallback={myProfile.data?.username?.[0]?.toUpperCase() ?? "?"}
        />
        <div className="min-w-0 flex-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, POST_MAX))}
            placeholder={t("newsComposePlaceholder")}
            rows={3}
            className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {draftImage ? (
            <div className="relative mt-1 inline-block">
              <img
                src={URL.createObjectURL(draftImage)}
                alt=""
                className="max-h-56 rounded-2xl border border-border object-cover"
              />
              <button
                onClick={() => setDraftImage(null)}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => imageInput.current?.click()}
              aria-label={t("photo")}
              className="grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-primary/10"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <input
              ref={imageInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setDraftImage(file);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {draft.length}/{POST_MAX}
              </span>
              <button
                onClick={() => void publish()}
                disabled={!draft.trim() || posting}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                {posting ? "..." : t("newsPublish")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {!posts.data?.length ? (
          <p className="py-14 text-center text-sm text-muted-foreground">{t("newsEmpty")}</p>
        ) : null}
        {(posts.data ?? []).map((post) => (
          <PostCard
            key={post.id}
            post={post}
            mine={post.user_id === user?.id}
            lang={lang}
            onLike={() => void toggleLike(post)}
            onRepost={() => void toggleRepost(post)}
            onOpenReplies={() => setOpenReplies(post)}
            onDelete={() => void deletePost(post)}
          />
        ))}
      </div>

      {openReplies ? (
        <RepliesSheet
          post={openReplies}
          onClose={() => setOpenReplies(null)}
          onReplied={() => void posts.refetch()}
        />
      ) : null}
    </div>
  );
}

function PostCard({
  post,
  mine,
  lang,
  onLike,
  onRepost,
  onOpenReplies,
  onDelete,
}: {
  post: Post;
  mine: boolean;
  lang: string;
  onLike: () => void;
  onRepost: () => void;
  onOpenReplies: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const imageUrl = useSignedUrl(post.image_url);
  return (
    <article className="flex gap-3 py-4">
      <Link to="/users/$id" params={{ id: post.author?.username ?? post.user_id }}>
        <StoredImage
          path={post.author?.avatar_url}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full object-cover"
          fallback={post.author?.username?.[0]?.toUpperCase() ?? "?"}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            to="/users/$id"
            params={{ id: post.author?.username ?? post.user_id }}
            className="truncate font-bold hover:underline"
          >
            {post.author?.username ?? "?"}
          </Link>
          {post.author?.verified ? <Verified /> : null}
          <span className="shrink-0 text-muted-foreground">· {timeAgo(post.created_at, lang)}</span>
          {mine ? (
            <button
              onClick={onDelete}
              aria-label={t("delete")}
              className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {post.content}
        </p>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="mt-2 max-h-80 w-full rounded-2xl border border-border object-cover"
          />
        ) : null}
        <div className="mt-3 flex max-w-xs items-center justify-between text-muted-foreground">
          <button
            onClick={onOpenReplies}
            className="flex items-center gap-1.5 text-xs transition hover:text-primary"
          >
            <MessageCircle className="h-4 w-4" /> {post.replies_count || ""}
          </button>
          <button
            onClick={onRepost}
            className={cn(
              "flex items-center gap-1.5 text-xs transition hover:text-emerald-500",
              post.reposted && "text-emerald-500",
            )}
          >
            <Repeat2 className="h-4 w-4" /> {post.reposts_count || ""}
          </button>
          <button
            onClick={onLike}
            className={cn(
              "flex items-center gap-1.5 text-xs transition hover:text-pink-500",
              post.liked && "text-pink-500",
            )}
          >
            <Heart className="h-4 w-4" fill={post.liked ? "currentColor" : "none"} />
            {post.likes_count || ""}
          </button>
        </div>
      </div>
    </article>
  );
}

function RepliesSheet({
  post,
  onClose,
  onReplied,
}: {
  post: Post;
  onClose: () => void;
  onReplied: () => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const replies = useQuery({
    queryKey: ["feed-post-replies", post.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("feed_post_replies")
        .select("id,user_id,content,created_at")
        .eq("post_id", post.id)
        .order("created_at");
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: authors } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((authors ?? []).map((a) => [a.id, a]));
      return (rows ?? []).map((r) => ({ ...r, author: byId.get(r.user_id) }));
    },
  });

  async function send() {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("feed_post_replies").insert({
        post_id: post.id,
        user_id: user.id,
        content: text.trim().slice(0, REPLY_MAX),
      });
      if (error) throw error;
      setText("");
      void replies.refetch();
      onReplied();
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={t("newsReplies")}>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto">
        <div className="rounded-2xl bg-surface p-3 text-sm text-muted-foreground">{post.content}</div>
        {!replies.data?.length ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{t("newsNoReplies")}</p>
        ) : null}
        {(replies.data ?? []).map((r) => (
          <div key={r.id} className="flex items-start gap-2">
            <StoredImage
              path={r.author?.avatar_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
              fallback={r.author?.username?.[0]?.toUpperCase() ?? "?"}
            />
            <div className="min-w-0 flex-1 rounded-2xl bg-surface px-3 py-2">
              <p className="text-xs font-bold">{r.author?.username ?? "?"}</p>
              <p className="mt-0.5 text-sm">{r.content}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(r.created_at, lang)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, REPLY_MAX))}
          placeholder={t("newsReplyPlaceholder")}
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none"
        />
        <button
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full spark-gradient text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </Sheet>
  );
}
