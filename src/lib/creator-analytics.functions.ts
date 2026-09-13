import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY_MS = 86_400_000;

export const getCreatorAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: videos, error: videoError } = await supabaseAdmin
      .from("videos")
      .select(
        "id,caption,created_at,views_count,likes_count,comments_count,favorites_count,reposts_count,shares_count",
      )
      .eq("user_id", context.userId);
    if (videoError) throw videoError;

    const videoIds = (videos ?? []).map((video) => video.id);
    const since = new Date(Date.now() - 13 * DAY_MS);
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    const [viewsResult, watchResult, likesResult] = videoIds.length
      ? await Promise.all([
          supabaseAdmin
            .from("video_views")
            .select("video_id,viewer_id,created_at")
            .in("video_id", videoIds)
            .gte("created_at", sinceIso)
            .limit(50_000),
          supabaseAdmin
            .from("video_watch_events")
            .select("video_id,watch_ms,watch_ratio,completed,skipped,replayed,created_at")
            .in("video_id", videoIds)
            .gte("created_at", sinceIso)
            .limit(50_000),
          supabaseAdmin
            .from("video_likes")
            .select("video_id,created_at")
            .in("video_id", videoIds)
            .gte("created_at", sinceIso)
            .limit(50_000),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

    for (const result of [viewsResult, watchResult, likesResult]) {
      if (result.error) throw result.error;
    }

    const daily = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(since.getTime() + index * DAY_MS);
      return {
        date: date.toISOString().slice(0, 10),
        views: 0,
        likes: 0,
        retentionTotal: 0,
        retentionEvents: 0,
      };
    });
    const byDate = new Map(daily.map((day) => [day.date, day]));

    for (const view of viewsResult.data ?? []) {
      const day = byDate.get(view.created_at.slice(0, 10));
      if (day) day.views += 1;
    }
    for (const like of likesResult.data ?? []) {
      const day = byDate.get(like.created_at.slice(0, 10));
      if (day) day.likes += 1;
    }
    for (const event of watchResult.data ?? []) {
      const day = byDate.get(event.created_at.slice(0, 10));
      if (day) {
        day.retentionTotal += Number(event.watch_ratio);
        day.retentionEvents += 1;
      }
    }

    const watchEvents = watchResult.data ?? [];
    const uniqueViewers = new Set(
      (viewsResult.data ?? [])
        .map((view) => view.viewer_id)
        .filter((viewerId): viewerId is string => Boolean(viewerId)),
    ).size;

    return {
      uniqueViewers,
      averageRetention: watchEvents.length
        ? watchEvents.reduce((total, event) => total + Number(event.watch_ratio), 0) /
          watchEvents.length
        : 0,
      completionRate: watchEvents.length
        ? watchEvents.filter((event) => event.completed).length / watchEvents.length
        : 0,
      skipRate: watchEvents.length
        ? watchEvents.filter((event) => event.skipped).length / watchEvents.length
        : 0,
      averageWatchMs: watchEvents.length
        ? watchEvents.reduce((total, event) => total + event.watch_ms, 0) / watchEvents.length
        : 0,
      replays: watchEvents.filter((event) => event.replayed).length,
      daily: daily.map(({ retentionTotal, retentionEvents, ...day }) => ({
        ...day,
        retention: retentionEvents ? retentionTotal / retentionEvents : 0,
      })),
    };
  });
