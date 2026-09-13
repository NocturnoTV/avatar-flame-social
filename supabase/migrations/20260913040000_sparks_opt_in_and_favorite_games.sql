-- Sparks becomes opt-in, and the deck is ranked by real shared signals
-- (favorite games in common, same country, closest age) instead of just
-- recency. Written defensively since an equivalent favorite_games/
-- sparks_enabled schema may already exist from another migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS sparks_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Curated "favorite games" (what shows on the profile and feeds matching),
-- distinct from roblox_games (auto-synced from the linked Roblox account).
CREATE TABLE IF NOT EXISTS public.favorite_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.favorite_games
  ADD COLUMN IF NOT EXISTS roblox_universe_id TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_games TO authenticated;
GRANT ALL ON public.favorite_games TO service_role;
ALTER TABLE public.favorite_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "favorite games readable" ON public.favorite_games;
CREATE POLICY "favorite games readable" ON public.favorite_games FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), user_id));
DROP POLICY IF EXISTS "own favorite games" ON public.favorite_games;
DROP POLICY IF EXISTS "manage own favorite games" ON public.favorite_games;
CREATE POLICY "manage own favorite games" ON public.favorite_games FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS favorite_games_user_idx ON public.favorite_games (user_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS favorite_games_user_universe_unique
  ON public.favorite_games (user_id, roblox_universe_id)
  WHERE roblox_universe_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.limit_favorite_games()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.favorite_games WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'max_five_games';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS favorite_games_limit ON public.favorite_games;
CREATE TRIGGER favorite_games_limit BEFORE INSERT ON public.favorite_games
FOR EACH ROW EXECUTE FUNCTION public.limit_favorite_games();
REVOKE ALL ON FUNCTION public.limit_favorite_games() FROM PUBLIC, anon, authenticated;

-- Deck RPC: require an explicit Sparks opt-in, and rank candidates by
-- shared favorite games, same country, then closest age, before falling
-- back to recent activity.
CREATE OR REPLACE FUNCTION public.spark_deck(_limit INT DEFAULT 20, _lang TEXT DEFAULT NULL, _min_age INT DEFAULT 13, _max_age INT DEFAULT 99)
RETURNS SETOF public.profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT birth_date, country FROM public.profiles WHERE id = auth.uid()
  ),
  my_games AS (
    SELECT DISTINCT lower(name) AS name, roblox_universe_id
    FROM public.favorite_games WHERE user_id = auth.uid()
  )
  SELECT p.*
  FROM public.profiles p, me
  WHERE p.id <> auth.uid()
    AND p.onboarding_completed
    AND p.sparks_enabled
    AND NOT public.is_blocked(auth.uid(), p.id)
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = auth.uid() AND s.target_id = p.id)
    AND (_lang IS NULL OR p.language = _lang)
    AND (p.birth_date IS NULL OR EXTRACT(YEAR FROM age(p.birth_date)) BETWEEN _min_age AND _max_age)
  ORDER BY
    (
      SELECT count(*) FROM public.favorite_games fg
      WHERE fg.user_id = p.id
        AND (
          (fg.roblox_universe_id IS NOT NULL AND fg.roblox_universe_id IN (SELECT roblox_universe_id FROM my_games WHERE roblox_universe_id IS NOT NULL))
          OR lower(fg.name) IN (SELECT name FROM my_games)
        )
    ) DESC,
    (CASE WHEN me.country IS NOT NULL AND p.country IS NOT NULL AND p.country = me.country THEN 1 ELSE 0 END) DESC,
    (CASE
      WHEN p.birth_date IS NOT NULL AND me.birth_date IS NOT NULL
      THEN ABS(EXTRACT(YEAR FROM age(p.birth_date)) - EXTRACT(YEAR FROM age(me.birth_date)))
      ELSE 999
    END) ASC,
    p.last_active_at DESC
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.spark_deck(INT, TEXT, INT, INT) TO authenticated;
