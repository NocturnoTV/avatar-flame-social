-- =========================================================
-- 1. Sensitive profile data moved to a private table
-- =========================================================
CREATE TABLE public.profiles_private (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date DATE,
  parent_name TEXT,
  parent_email TEXT,
  parental_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles_private TO authenticated;
GRANT ALL ON public.profiles_private TO service_role;
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own private profile" ON public.profiles_private FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff read private profile" ON public.profiles_private FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER profiles_private_touch BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;

INSERT INTO public.profiles_private (user_id, birth_date, parent_name, parent_email, parental_consent)
SELECT id, birth_date, parent_name, parent_email, COALESCE(parental_consent, false)
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.profiles p
SET age = EXTRACT(YEAR FROM age(pp.birth_date))::int
FROM public.profiles_private pp
WHERE pp.user_id = p.id AND pp.birth_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_profile_age()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET age = CASE WHEN NEW.birth_date IS NULL THEN NULL
                    ELSE EXTRACT(YEAR FROM age(NEW.birth_date))::int END
   WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_profile_age() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_private_sync_age
AFTER INSERT OR UPDATE OF birth_date ON public.profiles_private
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_age();

-- rebuild spark_deck against the private table before dropping columns
CREATE OR REPLACE FUNCTION public.spark_deck(_limit integer DEFAULT 20, _lang text DEFAULT NULL::text, _min_age integer DEFAULT 13, _max_age integer DEFAULT 99)
RETURNS SETOF public.profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  WITH me AS (
    SELECT pp.birth_date, p.country
    FROM public.profiles p
    LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
    WHERE p.id = auth.uid()
  ),
  my_games AS (
    SELECT DISTINCT lower(name) AS name, roblox_universe_id
    FROM public.favorite_games WHERE user_id = auth.uid()
  )
  SELECT p.*
  FROM public.profiles p, me
  LEFT JOIN LATERAL (SELECT NULL) ignored ON true
  WHERE p.id <> auth.uid()
    AND p.onboarding_completed
    AND p.sparks_enabled
    AND NOT public.is_blocked(auth.uid(), p.id)
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = auth.uid() AND s.target_id = p.id)
    AND (_lang IS NULL OR p.language = _lang)
    AND (p.age IS NULL OR p.age BETWEEN _min_age AND _max_age)
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
      WHEN p.age IS NOT NULL AND me.birth_date IS NOT NULL
      THEN ABS(p.age - EXTRACT(YEAR FROM age(me.birth_date)))
      ELSE 999
    END) ASC,
    p.last_active_at DESC
  LIMIT _limit;
$function$;

ALTER TABLE public.profiles
  DROP COLUMN birth_date,
  DROP COLUMN parent_name,
  DROP COLUMN parent_email,
  DROP COLUMN parental_consent;

-- =========================================================
-- 2. Storage: profile photos
-- =========================================================
DROP POLICY IF EXISTS "anon read profile photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "read profile photos" ON storage.objects;
CREATE POLICY "read profile photos" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR NOT public.is_blocked(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    )
  );

-- =========================================================
-- 3. Storage: voice messages (conversation participants only)
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_read_voice_object(_name text)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE cp.user_id = auth.uid()
      AND m.media_url = 'voice-messages/' || _name
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_voice_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_voice_object(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "read voice messages" ON storage.objects;
CREATE POLICY "read voice messages" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_read_voice_object(name)
    )
  );

-- =========================================================
-- 4. Storage: community media (members only)
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_read_community_object(_name text)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.icon_url = 'community-media/' || _name
       OR c.banner_url = 'community-media/' || _name
  ) OR EXISTS (
    SELECT 1
    FROM public.community_media cm
    JOIN public.community_members mem
      ON mem.community_id = cm.community_id AND mem.user_id = auth.uid()
    WHERE cm.media_url = 'community-media/' || _name
  ) OR EXISTS (
    SELECT 1
    FROM public.community_channel_messages ccm
    JOIN public.community_channels ch ON ch.id = ccm.channel_id
    JOIN public.community_members mem
      ON mem.community_id = ch.community_id AND mem.user_id = auth.uid()
    WHERE ccm.content LIKE '%' || _name || '%'
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_community_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_community_object(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "community_media_bucket_read" ON storage.objects;
CREATE POLICY "community_media_bucket_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'community-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_read_community_object(name)
    )
  );

-- =========================================================
-- 5. Function search_path + SECURITY DEFINER execute grants
-- =========================================================
ALTER FUNCTION public.touch_news_article_updated_at() SET search_path = public;

DO $$
DECLARE
  r RECORD;
  keep TEXT[] := ARRAY[
    'boost_video','bump_quest_progress','bump_quest_progress_for','community_add_affiliate',
    'community_add_game','community_assign_role','community_ban_member','community_create_category',
    'community_create_channel','community_create_role','community_delete_category','community_delete_channel',
    'community_delete_role','community_directory_rankings','community_kick_member','community_remove_affiliate',
    'community_remove_game','community_rename_channel','community_transfer_ownership','community_unassign_role',
    'community_update_role','create_group','ensure_daily_quests','gift_blox','gift_video_creator',
    'mark_conversation_read','perform_swipe','purchase_badge','spark_deck','start_direct_message',
    'status_report_series','toggle_badge_equipped','has_role','is_staff','is_blocked','is_member',
    'has_active_subscription','community_has_permission','community_move_channel',
    'can_read_voice_object','can_read_community_object','recommendation_analytics_summary'
  ];
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.prorettype::regtype::text AS ret
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    IF r.ret = 'trigger' OR NOT (r.proname = ANY (keep)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM authenticated', r.proname, r.args);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
END $$;