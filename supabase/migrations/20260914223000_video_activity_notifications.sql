-- New notification kinds for video activity, surfaced through the existing
-- "Team Spark" virtual thread (messages.$id.tsx's TeamSparkConversation)
-- alongside the welcome message, instead of a separate notifications page.
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'video_like';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'video_comment';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'video_favorite';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'video_repost';
