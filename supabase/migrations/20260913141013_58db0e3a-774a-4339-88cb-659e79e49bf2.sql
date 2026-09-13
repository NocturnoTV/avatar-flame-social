
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS recommendation_eligible BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.recommendation_config (
  id TEXT PRIMARY KEY,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  decay JSONB NOT NULL DEFAULT '{}'::jsonb,
  exploration_ratio DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recommendation_config TO authenticated;
GRANT ALL ON public.recommendation_config TO service_role;
ALTER TABLE public.recommendation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config readable by staff" ON public.recommendation_config FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "config managed by admins" ON public.recommendation_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.video_categories (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, category)
);
CREATE INDEX IF NOT EXISTS video_categories_category_idx ON public.video_categories(category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_categories TO authenticated;
GRANT ALL ON public.video_categories TO service_role;
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable" ON public.video_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories managed by owner" ON public.video_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND (v.user_id = auth.uid() OR public.is_staff(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND (v.user_id = auth.uid() OR public.is_staff(auth.uid()))));

CREATE TABLE IF NOT EXISTS public.user_topic_affinity (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  affinity DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_topic_affinity TO authenticated;
GRANT ALL ON public.user_topic_affinity TO service_role;
ALTER TABLE public.user_topic_affinity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own topic affinity" ON public.user_topic_affinity FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_creator_affinity (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affinity DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_creator_affinity TO authenticated;
GRANT ALL ON public.user_creator_affinity TO service_role;
ALTER TABLE public.user_creator_affinity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own creator affinity" ON public.user_creator_affinity FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.video_watch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  watch_ms INTEGER NOT NULL DEFAULT 0,
  watch_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  replayed BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT false,
  time_before_skip_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_watch_events_user_idx ON public.video_watch_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_watch_events_video_idx ON public.video_watch_events(video_id);
GRANT SELECT, INSERT ON public.video_watch_events TO authenticated;
GRANT ALL ON public.video_watch_events TO service_role;
ALTER TABLE public.video_watch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watch events" ON public.video_watch_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own watch events" ON public.video_watch_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.hidden_creators (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id)
);
GRANT SELECT, INSERT, DELETE ON public.hidden_creators TO authenticated;
GRANT ALL ON public.hidden_creators TO service_role;
ALTER TABLE public.hidden_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hidden creators" ON public.hidden_creators FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.hidden_categories (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
GRANT SELECT, INSERT, DELETE ON public.hidden_categories TO authenticated;
GRANT ALL ON public.hidden_categories TO service_role;
ALTER TABLE public.hidden_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hidden categories" ON public.hidden_categories FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.video_not_interested (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_not_interested TO authenticated;
GRANT ALL ON public.video_not_interested TO service_role;
ALTER TABLE public.video_not_interested ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own not interested" ON public.video_not_interested FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.recommendation_config (id, weights, decay, exploration_ratio)
VALUES ('default',
  '{"watch":0.3,"completion":0.2,"like":0.15,"comment":0.1,"share":0.1,"follow":0.05,"creatorAffinity":0.05,"topicAffinity":0.05}'::jsonb,
  '{"freshnessHalfLifeHours":36,"affinityHalfLifeDays":45}'::jsonb,
  0.15)
ON CONFLICT (id) DO NOTHING;
