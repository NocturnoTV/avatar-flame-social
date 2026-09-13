DELETE FROM public.video_views WHERE viewer_id IS NULL;

WITH duplicates AS (
  SELECT id, row_number() OVER (PARTITION BY video_id, viewer_id ORDER BY created_at, id) AS position
  FROM public.video_views
)
DELETE FROM public.video_views
WHERE id IN (SELECT id FROM duplicates WHERE position > 1);

ALTER TABLE public.video_views ALTER COLUMN viewer_id SET NOT NULL;
ALTER TABLE public.video_views ADD CONSTRAINT video_views_unique_viewer UNIQUE (video_id, viewer_id);

DROP TRIGGER IF EXISTS view_count_t ON public.video_views;

CREATE OR REPLACE FUNCTION public.refresh_unique_video_views()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_video UUID;
BEGIN
  target_video := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE public.videos
  SET views_count = (SELECT count(*) FROM public.video_views WHERE video_id = target_video)
  WHERE id = target_video;
  RETURN NULL;
END; $$;

CREATE TRIGGER view_count_t
AFTER INSERT OR DELETE ON public.video_views
FOR EACH ROW EXECUTE FUNCTION public.refresh_unique_video_views();

UPDATE public.videos v
SET views_count = (SELECT count(*) FROM public.video_views vv WHERE vv.video_id = v.id);

UPDATE public.news SET
  title = 'RDC 2026: what Roblox announced',
  subtitle = 'The major updates from the Roblox Developers Conference 2026',
  body = E'The Roblox Developers Conference 2026 focused on three areas: assisted creation, the creator economy and a more social platform.\n\nAssisted creation: new tools for generating objects, textures and scripts help creators prototype complete experiences directly in Studio.\n\nCreator economy: creator payouts are expanding to more countries and paid items are gaining new formats.\n\nPlatform: more expressive avatars, better mobile performance and social spaces designed to help friends reconnect between games.\n\nBloxSpark is not affiliated with or endorsed by Roblox Corporation. This article is an independent summary by the BloxSpark team.',
  tone = 'from-blue-600 to-sky-400'
WHERE title = 'RDC 2026 : tout ce que Roblox a annoncé';
