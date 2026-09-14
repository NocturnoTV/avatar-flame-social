-- "Actualités" — a real, X/Twitter-style social feed of user posts. Distinct
-- from the existing admin-curated `news` announcements table.

CREATE TABLE IF NOT EXISTS public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  image_url TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,
  reposts_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feed_posts_created_at_idx ON public.feed_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS feed_posts_user_idx ON public.feed_posts (user_id);

GRANT SELECT ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_posts_read_all" ON public.feed_posts;
CREATE POLICY "feed_posts_read_all" ON public.feed_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feed_posts_insert_own" ON public.feed_posts;
CREATE POLICY "feed_posts_insert_own" ON public.feed_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "feed_posts_delete_own" ON public.feed_posts;
CREATE POLICY "feed_posts_delete_own" ON public.feed_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.feed_post_likes (
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.feed_post_likes TO authenticated;
GRANT ALL ON public.feed_post_likes TO service_role;
ALTER TABLE public.feed_post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_post_likes_read_all" ON public.feed_post_likes;
CREATE POLICY "feed_post_likes_read_all" ON public.feed_post_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feed_post_likes_manage_own" ON public.feed_post_likes;
CREATE POLICY "feed_post_likes_manage_own" ON public.feed_post_likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.feed_post_reposts (
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.feed_post_reposts TO authenticated;
GRANT ALL ON public.feed_post_reposts TO service_role;
ALTER TABLE public.feed_post_reposts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_post_reposts_read_all" ON public.feed_post_reposts;
CREATE POLICY "feed_post_reposts_read_all" ON public.feed_post_reposts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feed_post_reposts_manage_own" ON public.feed_post_reposts;
CREATE POLICY "feed_post_reposts_manage_own" ON public.feed_post_reposts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.feed_post_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_post_replies_post_idx ON public.feed_post_replies (post_id, created_at);
GRANT SELECT ON public.feed_post_replies TO authenticated;
GRANT ALL ON public.feed_post_replies TO service_role;
ALTER TABLE public.feed_post_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_post_replies_read_all" ON public.feed_post_replies;
CREATE POLICY "feed_post_replies_read_all" ON public.feed_post_replies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feed_post_replies_insert_own" ON public.feed_post_replies;
CREATE POLICY "feed_post_replies_insert_own" ON public.feed_post_replies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "feed_post_replies_delete_own" ON public.feed_post_replies;
CREATE POLICY "feed_post_replies_delete_own" ON public.feed_post_replies FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- counters ----------
CREATE OR REPLACE FUNCTION public.feed_post_likes_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS feed_post_likes_count ON public.feed_post_likes;
CREATE TRIGGER feed_post_likes_count AFTER INSERT OR DELETE ON public.feed_post_likes
FOR EACH ROW EXECUTE FUNCTION public.feed_post_likes_count_touch();

CREATE OR REPLACE FUNCTION public.feed_post_reposts_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET reposts_count = reposts_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET reposts_count = GREATEST(reposts_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS feed_post_reposts_count ON public.feed_post_reposts;
CREATE TRIGGER feed_post_reposts_count AFTER INSERT OR DELETE ON public.feed_post_reposts
FOR EACH ROW EXECUTE FUNCTION public.feed_post_reposts_count_touch();

CREATE OR REPLACE FUNCTION public.feed_post_replies_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET replies_count = replies_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS feed_post_replies_count ON public.feed_post_replies;
CREATE TRIGGER feed_post_replies_count AFTER INSERT OR DELETE ON public.feed_post_replies
FOR EACH ROW EXECUTE FUNCTION public.feed_post_replies_count_touch();

-- ---------- storage for post images ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('feed-posts', 'feed-posts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "feed_posts_bucket_read" ON storage.objects;
CREATE POLICY "feed_posts_bucket_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feed-posts');

DROP POLICY IF EXISTS "feed_posts_bucket_insert" ON storage.objects;
CREATE POLICY "feed_posts_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-posts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "feed_posts_bucket_delete" ON storage.objects;
CREATE POLICY "feed_posts_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed-posts' AND (storage.foldername(name))[1] = auth.uid()::text);
