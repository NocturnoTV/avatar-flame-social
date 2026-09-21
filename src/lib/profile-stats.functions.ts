import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdvancedStats = {
  views: number;
  likes: number;
  comments: number;
  favorites: number;
  reposts: number;
  followers: number;
  videoCount: number;
  engagementRate: number;
};

/** Advanced creator statistics are a Spark Plus perk, so entitlement is
 * checked here on the server instead of only hiding the panel client-side. */
export const getAdvancedStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvancedStats> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("spark_plus_active,spark_plus_expires_at")
      .eq("id", context.userId)
      .maybeSingle();

    const entitled =
      !!profile?.spark_plus_active &&
      (!profile.spark_plus_expires_at ||
        new Date(profile.spark_plus_expires_at).getTime() > Date.now());
    if (!entitled) throw new Error("Spark Plus requis");

    const [{ data: vids }, { count: followerCount }] = await Promise.all([
      context.supabase
        .from("videos")
        .select("views_count,likes_count,comments_count,favorites_count,reposts_count")
        .eq("user_id", context.userId),
      context.supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", context.userId),
    ]);

    const totals = (vids ?? []).reduce(
      (acc, v) => ({
        views: acc.views + (v.views_count ?? 0),
        likes: acc.likes + (v.likes_count ?? 0),
        comments: acc.comments + (v.comments_count ?? 0),
        favorites: acc.favorites + (v.favorites_count ?? 0),
        reposts: acc.reposts + (v.reposts_count ?? 0),
      }),
      { views: 0, likes: 0, comments: 0, favorites: 0, reposts: 0 },
    );
    const engagementRate = totals.views
      ? ((totals.likes + totals.comments + totals.favorites + totals.reposts) / totals.views) * 100
      : 0;

    return {
      ...totals,
      followers: followerCount ?? 0,
      videoCount: vids?.length ?? 0,
      engagementRate,
    };
  });
