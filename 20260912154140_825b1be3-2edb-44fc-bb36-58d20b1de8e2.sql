CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  caption TEXT,
  sound_name TEXT,
  duration_seconds NUMERIC,
  visibility TEXT NOT NULL DEFAULT 'public',
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  favorites_count INTEGER NOT NULL DEFAULT 0,
  reposts_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos_select" ON public.videos FOR SELECT TO authenticated
  USING ((visibility = 'public' AND NOT public.is_blocked(auth.uid(), user_id)) OR user_id = auth.uid());
CREATE POLICY "videos_insert" ON public.videos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "videos_update" ON public.videos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "videos_delete" ON public.videos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER videos_touch BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX videos_created_idx ON public.videos (created_at DESC);
CREATE INDEX videos_user_idx ON public.videos (user_id);

CREATE TABLE public.video_likes (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
CREATE TABLE public.video_favorites (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
CREATE TABLE public.video_reposts (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
CREATE TABLE public.video_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_likes, public.video_favorites, public.video_reposts, public.video_comments, public.video_views, public.follows TO authenticated;
GRANT ALL ON public.video_likes, public.video_favorites, public.video_reposts, public.video_comments, public.video_views, public.follows TO service_role;

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select" ON public.video_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_write" ON public.video_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes_delete" ON public.video_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "fav_select" ON public.video_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "fav_write" ON public.video_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fav_delete" ON public.video_favorites FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "repost_select" ON public.video_reposts FOR SELECT TO authenticated USING (true);
CREATE POLICY "repost_write" ON public.video_reposts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "repost_delete" ON public.video_reposts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "comments_select" ON public.video_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_write" ON public.video_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_delete" ON public.video_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "views_insert" ON public.video_views FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid() OR viewer_id IS NULL);
CREATE POLICY "views_select" ON public.video_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.user_id = auth.uid()));

CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

CREATE OR REPLACE FUNCTION public.video_counter()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _col TEXT; _vid UUID; _delta INT;
BEGIN
  _col := TG_ARGV[0];
  IF TG_OP = 'INSERT' THEN _vid := NEW.video_id; _delta := 1; ELSE _vid := OLD.video_id; _delta := -1; END IF;
  EXECUTE format('UPDATE public.videos SET %I = GREATEST(0, %I + $1) WHERE id = $2', _col, _col) USING _delta, _vid;
  RETURN NULL;
END; $$;

CREATE TRIGGER likes_count_t AFTER INSERT OR DELETE ON public.video_likes FOR EACH ROW EXECUTE FUNCTION public.video_counter('likes_count');
CREATE TRIGGER fav_count_t AFTER INSERT OR DELETE ON public.video_favorites FOR EACH ROW EXECUTE FUNCTION public.video_counter('favorites_count');
CREATE TRIGGER repost_count_t AFTER INSERT OR DELETE ON public.video_reposts FOR EACH ROW EXECUTE FUNCTION public.video_counter('reposts_count');
CREATE TRIGGER comment_count_t AFTER INSERT OR DELETE ON public.video_comments FOR EACH ROW EXECUTE FUNCTION public.video_counter('comments_count');
CREATE TRIGGER view_count_t AFTER INSERT ON public.video_views FOR EACH ROW EXECUTE FUNCTION public.video_counter('views_count');

CREATE POLICY "videos_bucket_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos');
CREATE POLICY "videos_bucket_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "videos_bucket_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);