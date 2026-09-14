-- Actualités Roblox: a real editorial news portal, admin-published only.
-- Distinct from both the old `news` announcement-ticker table (home page)
-- and the `feed_posts` user social feed (Actualités menu entry, now
-- pointed at this instead).

CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT CHECK (excerpt IS NULL OR char_length(excerpt) <= 300),
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'updates'
    CHECK (category IN ('updates', 'events', 'games', 'creators', 'development', 'community', 'security')),
  source TEXT NOT NULL DEFAULT 'Bloxspark',
  source_url TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  reading_time_minutes INTEGER NOT NULL DEFAULT 3,
  key_points TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_articles_status_idx ON public.news_articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS news_articles_category_idx ON public.news_articles (category);
CREATE INDEX IF NOT EXISTS news_articles_slug_idx ON public.news_articles (slug);

GRANT SELECT ON public.news_articles TO authenticated, anon;
GRANT ALL ON public.news_articles TO service_role;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_articles_read_published" ON public.news_articles;
CREATE POLICY "news_articles_read_published" ON public.news_articles FOR SELECT TO authenticated, anon
  USING (
    status = 'published'
    OR (status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= now())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "news_articles_admin_write" ON public.news_articles;
CREATE POLICY "news_articles_admin_write" ON public.news_articles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "news_articles_admin_update" ON public.news_articles;
CREATE POLICY "news_articles_admin_update" ON public.news_articles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "news_articles_admin_delete" ON public.news_articles;
CREATE POLICY "news_articles_admin_delete" ON public.news_articles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_news_article_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS news_articles_touch_updated_at ON public.news_articles;
CREATE TRIGGER news_articles_touch_updated_at BEFORE UPDATE ON public.news_articles
FOR EACH ROW EXECUTE FUNCTION public.touch_news_article_updated_at();

-- ---------- likes ----------
CREATE TABLE IF NOT EXISTS public.news_article_likes (
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
GRANT SELECT ON public.news_article_likes TO authenticated;
GRANT ALL ON public.news_article_likes TO service_role;
ALTER TABLE public.news_article_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_article_likes_read_all" ON public.news_article_likes;
CREATE POLICY "news_article_likes_read_all" ON public.news_article_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "news_article_likes_manage_own" ON public.news_article_likes;
CREATE POLICY "news_article_likes_manage_own" ON public.news_article_likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.news_article_likes_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news_articles SET likes_count = likes_count + 1 WHERE id = NEW.article_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.news_articles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.article_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS news_article_likes_count ON public.news_article_likes;
CREATE TRIGGER news_article_likes_count AFTER INSERT OR DELETE ON public.news_article_likes
FOR EACH ROW EXECUTE FUNCTION public.news_article_likes_count_touch();

-- ---------- saves ("Enregistrés") ----------
CREATE TABLE IF NOT EXISTS public.news_article_saves (
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
GRANT SELECT ON public.news_article_saves TO authenticated;
GRANT ALL ON public.news_article_saves TO service_role;
ALTER TABLE public.news_article_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_article_saves_own" ON public.news_article_saves;
CREATE POLICY "news_article_saves_own" ON public.news_article_saves FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- comments ----------
CREATE TABLE IF NOT EXISTS public.news_article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_article_comments_article_idx ON public.news_article_comments (article_id, created_at);
GRANT SELECT ON public.news_article_comments TO authenticated;
GRANT ALL ON public.news_article_comments TO service_role;
ALTER TABLE public.news_article_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_article_comments_read_all" ON public.news_article_comments;
CREATE POLICY "news_article_comments_read_all" ON public.news_article_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "news_article_comments_insert_own" ON public.news_article_comments;
CREATE POLICY "news_article_comments_insert_own" ON public.news_article_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "news_article_comments_delete_own_or_admin" ON public.news_article_comments;
CREATE POLICY "news_article_comments_delete_own_or_admin" ON public.news_article_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.news_article_comments_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news_articles SET comments_count = comments_count + 1 WHERE id = NEW.article_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.news_articles SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.article_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS news_article_comments_count ON public.news_article_comments;
CREATE TRIGGER news_article_comments_count AFTER INSERT OR DELETE ON public.news_article_comments
FOR EACH ROW EXECUTE FUNCTION public.news_article_comments_count_touch();

-- ---------- storage for article images ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-articles', 'news-articles', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "news_articles_bucket_read" ON storage.objects;
CREATE POLICY "news_articles_bucket_read" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'news-articles');

DROP POLICY IF EXISTS "news_articles_bucket_admin_write" ON storage.objects;
CREATE POLICY "news_articles_bucket_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'news-articles' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "news_articles_bucket_admin_delete" ON storage.objects;
CREATE POLICY "news_articles_bucket_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'news-articles' AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr';
