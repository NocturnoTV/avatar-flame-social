import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TOPIC_CATEGORIES,
  generatePersonalizedFeed,
  recordHideCategory,
  recordHideCreator,
  recordNotInterested,
  recordPositiveAction,
  recordWatchEvent,
  resetRecommendationProfile,
} from "@/lib/recommendation-engine.server";

/** Personalized "For You" feed - see recommendation-engine.server.ts for the pipeline. */
export const getPersonalizedFeed = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().int().min(1).max(60).default(30) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const feed = await generatePersonalizedFeed(context.userId, data.limit);
    return feed.map((v) => ({
      id: v.id,
      user_id: v.user_id,
      storage_path: v.storage_path,
      mux_playback_id: v.mux_playback_id,
      mux_status: v.mux_status,
      caption: v.caption,
      sound_name: v.sound_name,
      likes_count: v.likes_count,
      comments_count: v.comments_count,
      favorites_count: v.favorites_count,
      reposts_count: v.reposts_count,
      shares_count: v.shares_count,
      views_count: v.views_count,
      boosted_until: v.boosted_until,
      reason: v.reason,
      campaignId: v.campaignId ?? null,
      campaignGameUrl: v.campaignGameUrl ?? null,
    }));
  });

const watchSchema = z.object({
  videoId: z.string().uuid(),
  watchMs: z.number().min(0),
  durationSeconds: z.number().min(0.1),
  replayed: z.boolean().optional(),
});

export const logVideoWatch = createServerFn({ method: "POST" })
  .validator(watchSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await recordWatchEvent(context.userId, data.videoId, {
      watchMs: data.watchMs,
      durationSeconds: data.durationSeconds,
      replayed: data.replayed ?? false,
    });
    return { success: true };
  });

export const logPositiveAction = createServerFn({ method: "POST" })
  .validator(
    z.object({
      videoId: z.string().uuid(),
      action: z.enum(["like", "comment", "share", "follow", "favorite", "visit_profile"]),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await recordPositiveAction(context.userId, data.videoId, data.action);
    return { success: true };
  });

export const markNotInterested = createServerFn({ method: "POST" })
  .validator(z.object({ videoId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await recordNotInterested(context.userId, data.videoId);
    return { success: true };
  });

export const hideCreator = createServerFn({ method: "POST" })
  .validator(z.object({ creatorId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await recordHideCreator(context.userId, data.creatorId);
    return { success: true };
  });

export const hideCategory = createServerFn({ method: "POST" })
  .validator(z.object({ category: z.enum(TOPIC_CATEGORIES) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await recordHideCategory(context.userId, data.category);
    return { success: true };
  });

export const resetRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await resetRecommendationProfile(context.userId);
    return { success: true };
  });
