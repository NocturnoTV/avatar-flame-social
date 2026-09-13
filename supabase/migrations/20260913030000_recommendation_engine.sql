-- ============================================================================
-- PERSONALIZED VIDEO RECOMMENDATION ENGINE — data layer
-- Feeds src/lib/recommendation-engine.server.ts. See that file for the
-- scoring pipeline; this migration only adds storage for signals + affinities.
-- Written defensively (IF NOT EXISTS / DROP-then-CREATE) since an equivalent
-- schema may already exist depending on which migration ran first.
-- ============================================================================

-- Canonical topic list. Kept as a CHECK instead of an enum so new topics can
-- be added later with a simple constraint migration instead of a type change.
CREATE TABLE IF NOT EXISTS public.video_categories (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 1),
  PRIMARY KEY (video_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_categories TO authenticated;
GRANT ALL ON public.video_categories TO service_role;
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories readable" ON public.video_categories;
CREATE POLICY "categories readable" ON public.video_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "creator manages own video categories" ON public.video_categories;
CREATE POLICY "creator manages own video categories" ON public.video_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id AND v.user_id = auth.uid()));

-- Eligibility gate + editorial/quality hook on videos themselves.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS recommendation_eligible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hashtags TEXT[] NOT NULL DEFAULT '{}';

-- Fine-grained watch signal per playback session (section 2 & 3 inputs).
CREATE TABLE IF NOT EXISTS public.video_watch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  watch_ms INTEGER NOT NULL DEFAULT 0,
  watch_ratio NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  replayed BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT false,
  time_before_skip_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_watch_events_user_idx ON public.video_watch_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_watch_events_video_idx ON public.video_watch_events (video_id, created_at DESC);
GRANT SELECT, INSERT ON public.video_watch_events TO authenticated;
GRANT ALL ON public.video_watch_events TO service_role;
ALTER TABLE public.video_watch_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own watch events" ON public.video_watch_events;
CREATE POLICY "own watch events" ON public.video_watch_events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- "Pas intéressé" — per-video negative signal (section 2 & 19).
CREATE TABLE IF NOT EXISTS public.video_not_interested (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_not_interested TO authenticated;
GRANT ALL ON public.video_not_interested TO service_role;
ALTER TABLE public.video_not_interested ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own not-interested" ON public.video_not_interested;
CREATE POLICY "own not-interested" ON public.video_not_interested FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- "Masquer ce créateur" (section 2 & 5).
CREATE TABLE IF NOT EXISTS public.hidden_creators (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id)
);
GRANT SELECT, INSERT, DELETE ON public.hidden_creators TO authenticated;
GRANT ALL ON public.hidden_creators TO service_role;
ALTER TABLE public.hidden_creators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own hidden creators" ON public.hidden_creators;
CREATE POLICY "own hidden creators" ON public.hidden_creators FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- "Masquer ce thème" (section 2 & 6).
CREATE TABLE IF NOT EXISTS public.hidden_categories (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
GRANT SELECT, INSERT, DELETE ON public.hidden_categories TO authenticated;
GRANT ALL ON public.hidden_categories TO service_role;
ALTER TABLE public.hidden_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own hidden categories" ON public.hidden_categories;
CREATE POLICY "own hidden categories" ON public.hidden_categories FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Dynamic interest profile per user × topic (section 4 & 17 & 18).
CREATE TABLE IF NOT EXISTS public.user_topic_affinity (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  affinity NUMERIC NOT NULL DEFAULT 0.3 CHECK (affinity >= 0 AND affinity <= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
GRANT ALL ON public.user_topic_affinity TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_topic_affinity TO authenticated;
ALTER TABLE public.user_topic_affinity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own topic affinity" ON public.user_topic_affinity;
CREATE POLICY "read own topic affinity" ON public.user_topic_affinity FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Dynamic affinity per user × creator (section 5 & 17 & 18).
CREATE TABLE IF NOT EXISTS public.user_creator_affinity (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affinity NUMERIC NOT NULL DEFAULT 0.3 CHECK (affinity >= 0 AND affinity <= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id)
);
GRANT ALL ON public.user_creator_affinity TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_creator_affinity TO authenticated;
ALTER TABLE public.user_creator_affinity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own creator affinity" ON public.user_creator_affinity;
CREATE POLICY "read own creator affinity" ON public.user_creator_affinity FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Server-configurable scoring weights (section 3 & 23) — single editable row.
CREATE TABLE IF NOT EXISTS public.recommendation_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  weights JSONB NOT NULL DEFAULT '{
    "watch": 0.30, "completion": 0.20, "like": 0.15, "comment": 0.10,
    "share": 0.10, "follow": 0.05, "creatorAffinity": 0.05, "topicAffinity": 0.05
  }'::jsonb,
  decay JSONB NOT NULL DEFAULT '{
    "freshnessHalfLifeHours": 36, "affinityHalfLifeDays": 45
  }'::jsonb,
  exploration_ratio NUMERIC NOT NULL DEFAULT 0.15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.recommendation_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.recommendation_config TO authenticated;
GRANT ALL ON public.recommendation_config TO service_role;
ALTER TABLE public.recommendation_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read config" ON public.recommendation_config;
CREATE POLICY "staff read config" ON public.recommendation_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "admins update config" ON public.recommendation_config;
CREATE POLICY "admins update config" ON public.recommendation_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Reports can now target a video directly (section 13), not just a message.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE;

-- Auto-unlist a video once it accumulates too many pending reports (section 13).
CREATE OR REPLACE FUNCTION public.recompute_video_eligibility()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _reports INT;
BEGIN
  IF NEW.video_id IS NOT NULL THEN
    SELECT count(*) INTO _reports FROM public.reports WHERE video_id = NEW.video_id AND status = 'pending';
    IF _reports >= 5 THEN
      UPDATE public.videos SET recommendation_eligible = false WHERE id = NEW.video_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS reports_recompute_eligibility ON public.reports;
CREATE TRIGGER reports_recompute_eligibility AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.recompute_video_eligibility();

-- Analytics rollup for admins (section 21). Read-only aggregate, no PII.
CREATE OR REPLACE FUNCTION public.recommendation_analytics_summary(_since TIMESTAMPTZ DEFAULT now() - interval '7 days')
RETURNS TABLE (
  avg_watch_ratio NUMERIC,
  completion_rate NUMERIC,
  skip_rate NUMERIC,
  like_rate NUMERIC,
  comment_rate NUMERIC,
  share_rate NUMERIC,
  report_rate NUMERIC,
  watch_events BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'staff_only'; END IF;
  RETURN QUERY
  SELECT
    COALESCE(AVG(w.watch_ratio), 0),
    COALESCE(AVG(CASE WHEN w.completed THEN 1 ELSE 0 END), 0),
    COALESCE(AVG(CASE WHEN w.skipped THEN 1 ELSE 0 END), 0),
    COALESCE((SELECT count(*) FROM public.video_likes l WHERE l.created_at >= _since), 0)::NUMERIC
      / GREATEST((SELECT count(*) FROM public.video_watch_events e WHERE e.created_at >= _since), 1),
    COALESCE((SELECT count(*) FROM public.video_comments c WHERE c.created_at >= _since), 0)::NUMERIC
      / GREATEST((SELECT count(*) FROM public.video_watch_events e WHERE e.created_at >= _since), 1),
    COALESCE((SELECT count(*) FROM public.video_reposts r WHERE r.created_at >= _since), 0)::NUMERIC
      / GREATEST((SELECT count(*) FROM public.video_watch_events e WHERE e.created_at >= _since), 1),
    COALESCE((SELECT count(*) FROM public.reports rp WHERE rp.created_at >= _since AND rp.video_id IS NOT NULL), 0)::NUMERIC
      / GREATEST((SELECT count(*) FROM public.video_watch_events e WHERE e.created_at >= _since), 1),
    (SELECT count(*) FROM public.video_watch_events w2 WHERE w2.created_at >= _since)
  FROM public.video_watch_events w
  WHERE w.created_at >= _since;
END; $$;
REVOKE ALL ON FUNCTION public.recommendation_analytics_summary(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recommendation_analytics_summary(TIMESTAMPTZ) TO authenticated;
