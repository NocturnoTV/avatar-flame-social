
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sparks_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.video_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.video_comments(id) ON DELETE CASCADE;
ALTER TABLE public.video_comments ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.video_comments ADD COLUMN IF NOT EXISTS media_type TEXT;

CREATE TABLE IF NOT EXISTS public.favorite_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS favorite_games_user_idx ON public.favorite_games(user_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_games TO authenticated;
GRANT ALL ON public.favorite_games TO service_role;
ALTER TABLE public.favorite_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "favorite games readable" ON public.favorite_games;
CREATE POLICY "favorite games readable" ON public.favorite_games FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "own favorite games" ON public.favorite_games;
DROP POLICY IF EXISTS "manage own favorite games" ON public.favorite_games;
CREATE POLICY "own favorite games" ON public.favorite_games FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories(expires_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories readable" ON public.stories;
CREATE POLICY "stories readable" ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now() AND NOT public.is_blocked(auth.uid(), user_id));
DROP POLICY IF EXISTS "own stories" ON public.stories;
CREATE POLICY "own stories" ON public.stories FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own story views" ON public.story_views;
CREATE POLICY "own story views" ON public.story_views FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert own story views" ON public.story_views;
CREATE POLICY "insert own story views" ON public.story_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
