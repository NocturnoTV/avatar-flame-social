ALTER TABLE public.video_comments
  ADD COLUMN parent_id UUID REFERENCES public.video_comments(id) ON DELETE CASCADE,
  ADD COLUMN media_url TEXT,
  ADD COLUMN media_type TEXT CHECK (media_type IN ('gif', 'sticker'));

CREATE INDEX video_comments_parent_idx ON public.video_comments(parent_id);

CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE TABLE public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.stories, public.story_views TO authenticated;
GRANT ALL ON public.stories, public.story_views TO service_role;

CREATE POLICY "stories_select" ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now() AND NOT public.is_blocked(auth.uid(), user_id));
CREATE POLICY "stories_insert" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "stories_delete" ON public.stories FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "story_views_select" ON public.story_views FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "story_views_insert" ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "stories_bucket_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories');
CREATE POLICY "stories_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "stories_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);
