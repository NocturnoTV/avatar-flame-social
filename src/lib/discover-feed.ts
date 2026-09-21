import { supabase } from "@/integrations/supabase/client";
import { getPersonalizedFeed } from "@/lib/recommendation.functions";

export type VideoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  sound_name: string | null;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  reposts_count: number;
  shares_count: number;
  views_count: number;
  boosted_until?: string | null;
  reason?: string;
};

const VIDEO_COLUMNS =
  "id,user_id,storage_path,thumbnail_path,caption,sound_name,likes_count,comments_count,favorites_count,reposts_count,shares_count,views_count,boosted_until";

/** Shared between the Discover page's own query and the bottom nav's
 * prefetch-on-hover, so both hit the exact same cache entry - the whole
 * point of prefetching is wasted if the two ever compute a different key
 * or fetch slightly different data. */
export function discoverFeedKey(
  userId: string | undefined,
  tab: "foryou" | "following",
  followingIds: string[] | undefined,
  pinnedVideoId: string | undefined,
) {
  return ["feed", userId, tab, followingIds?.join(","), pinnedVideoId] as const;
}

export async function fetchDiscoverFeed({
  userId,
  tab,
  followingIds,
  pinnedVideoId,
}: {
  userId: string;
  tab: "foryou" | "following";
  followingIds: string[];
  pinnedVideoId?: string;
}): Promise<{
  videos: VideoRow[];
  profiles: Record<
    string,
    { username: string | null; avatar_url: string | null; verified: boolean | null }
  >;
}> {
  let videos: VideoRow[];
  if (tab === "foryou") {
    // The personalized engine already excludes the viewer's own videos from
    // its candidate pool (see getCandidateVideos) - "For You" is for
    // discovering other creators, not a place to keep re-surfacing your own
    // posts every time you open the feed.
    const rows = await getPersonalizedFeed({ data: { limit: 30 } });
    videos = rows.map((v) => ({ ...v, thumbnail_path: null }));
  } else {
    const ids = [...new Set([userId, ...followingIds])];
    const { data, error } = await supabase
      .from("videos")
      .select(VIDEO_COLUMNS)
      .eq("visibility", "public")
      .eq("moderation_status", "approved")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    videos = (data ?? []) as VideoRow[];
  }

  if (pinnedVideoId && !videos.some((v) => v.id === pinnedVideoId)) {
    const { data: pinned } = await supabase
      .from("videos")
      .select(VIDEO_COLUMNS)
      .eq("id", pinnedVideoId)
      .eq("moderation_status", "approved")
      .maybeSingle();
    if (pinned) videos = [pinned as VideoRow, ...videos];
  } else if (pinnedVideoId) {
    videos = [
      videos.find((v) => v.id === pinnedVideoId)!,
      ...videos.filter((v) => v.id !== pinnedVideoId),
    ];
  }

  const ids = [...new Set(videos.map((v) => v.user_id))];
  const profiles: Record<
    string,
    { username: string | null; avatar_url: string | null; verified: boolean | null }
  > = {};
  if (ids.length) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id,username,avatar_url,verified")
      .in("id", ids);
    for (const row of p ?? [])
      profiles[row.id] = {
        username: row.username,
        avatar_url: row.avatar_url,
        verified: row.verified,
      };
    const { data: plusProfiles } = await supabase
      .from("profiles")
      .select("id,spark_plus_active,spark_plus_expires_at")
      .in("id", ids);
    const boosted = new Set(
      (plusProfiles ?? [])
        .filter(
          (profile) =>
            profile.spark_plus_active &&
            (!profile.spark_plus_expires_at ||
              new Date(profile.spark_plus_expires_at).getTime() > Date.now()),
        )
        .map((profile) => profile.id),
    );
    videos = videos
      .map((video, index) => ({ video, index }))
      .sort((a, b) => {
        const boostDifference =
          Number(boosted.has(b.video.user_id)) - Number(boosted.has(a.video.user_id));
        return boostDifference || a.index - b.index;
      })
      .map(({ video }) => video);
  }
  return { videos, profiles };
}
