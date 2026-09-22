import { supabase } from "@/integrations/supabase/client";

export type PostMedia = { url: string; type: "image"; alt?: string };
export type ReplyPermission = "everyone" | "following" | "mentioned" | "none";

export type PostRow = {
  id: string;
  user_id: string;
  content: string;
  media: PostMedia[];
  reply_to_id: string | null;
  quote_post_id: string | null;
  reply_permission: ReplyPermission;
  likes_count: number;
  replies_count: number;
  reposts_count: number;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type PostAuthor = { username: string | null; avatar_url: string | null; verified: boolean | null };
export type PostAuthors = Record<string, PostAuthor>;

export const POST_COLUMNS =
  "id,user_id,content,media,reply_to_id,quote_post_id,reply_permission,likes_count,replies_count,reposts_count,created_at,edited_at,deleted_at";

/** Same "candidates -> heuristic score -> rank" shape as the video
 * recommendation engine, just much simpler: engagement + recency decay,
 * with a boost for authors the viewer already follows. A real interest/
 * topic model is out of scope for this first version. */
function rankForYou(posts: PostRow[], followingIds: string[]): PostRow[] {
  const followed = new Set(followingIds);
  return posts
    .map((post) => {
      const ageHours = Math.max((Date.now() - new Date(post.created_at).getTime()) / 3_600_000, 0);
      const engagement = post.likes_count + post.reposts_count * 2 + post.replies_count * 1.5;
      const recency = 1 / (1 + ageHours / 6);
      const followBoost = followed.has(post.user_id) ? 1.4 : 1;
      return { post, score: (engagement + 1) * recency * followBoost };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.post);
}

async function fetchAuthors(userIds: string[]): Promise<PostAuthors> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {};
  const { data } = await supabase.from("profiles").select("id,username,avatar_url,verified").in("id", ids);
  const authors: PostAuthors = {};
  for (const p of data ?? []) authors[p.id] = { username: p.username, avatar_url: p.avatar_url, verified: p.verified };
  return authors;
}

export function feedKey(userId: string | undefined, tab: "foryou" | "following", followingIds: string[] | undefined) {
  return ["feed-posts", userId, tab, followingIds?.join(",")] as const;
}

export async function fetchFeed({
  userId,
  tab,
  followingIds,
}: {
  userId: string;
  tab: "foryou" | "following";
  followingIds: string[];
}): Promise<{ posts: PostRow[]; authors: PostAuthors }> {
  let posts: PostRow[];
  if (tab === "following") {
    const ids = [...new Set([userId, ...followingIds])];
    const { data, error } = await supabase
      .from("feed_posts")
      .select(POST_COLUMNS)
      .is("deleted_at", null)
      .is("reply_to_id", null)
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    posts = (data ?? []) as PostRow[];
  } else {
    const { data, error } = await supabase
      .from("feed_posts")
      .select(POST_COLUMNS)
      .is("deleted_at", null)
      .is("reply_to_id", null)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    posts = rankForYou((data ?? []) as PostRow[], followingIds).slice(0, 30);
  }
  const authors = await fetchAuthors(posts.map((p) => p.user_id));
  return { posts, authors };
}

export async function fetchTrendingPostsToday(limit = 4): Promise<{ posts: PostRow[]; authors: PostAuthors }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("feed_posts")
    .select(POST_COLUMNS)
    .is("deleted_at", null)
    .is("reply_to_id", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit * 5);
  if (error) throw error;
  const pool = (data ?? []) as PostRow[];
  const posts = pool
    .map((post) => ({
      post,
      score: post.likes_count + post.reposts_count * 2 + post.replies_count * 1.5,
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.post)
    .slice(0, limit);
  const authors = await fetchAuthors(posts.map((p) => p.user_id));
  return { posts, authors };
}

export async function fetchUserPosts(userId: string): Promise<{ posts: PostRow[]; authors: PostAuthors }> {
  const { data, error } = await supabase
    .from("feed_posts")
    .select(POST_COLUMNS)
    .is("deleted_at", null)
    .is("reply_to_id", null)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const posts = (data ?? []) as PostRow[];
  const authors = await fetchAuthors(posts.map((p) => p.user_id));
  return { posts, authors };
}

export async function fetchPostThread(postId: string): Promise<{
  post: PostRow | null;
  quoted: PostRow | null;
  replies: PostRow[];
  authors: PostAuthors;
}> {
  const { data: post } = await supabase.from("feed_posts").select(POST_COLUMNS).eq("id", postId).maybeSingle();
  if (!post) return { post: null, quoted: null, replies: [], authors: {} };
  const [{ data: quoted }, { data: replyRows }] = await Promise.all([
    (post as PostRow).quote_post_id
      ? supabase.from("feed_posts").select(POST_COLUMNS).eq("id", (post as PostRow).quote_post_id!).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("feed_posts")
      .select(POST_COLUMNS)
      .eq("reply_to_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);
  const replies = (replyRows ?? []) as PostRow[];
  const allUserIds = [
    (post as PostRow).user_id,
    ...(quoted ? [(quoted as PostRow).user_id] : []),
    ...replies.map((r) => r.user_id),
  ];
  const authors = await fetchAuthors(allUserIds);
  return { post: post as PostRow, quoted: quoted as PostRow | null, replies, authors };
}
