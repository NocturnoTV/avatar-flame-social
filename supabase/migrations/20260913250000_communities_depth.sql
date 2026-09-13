-- Communities depth: Discussions, Find Players (LFG), Events, Media, and an
-- XP leaderboard. All additive on top of the existing communities /
-- community_members / community_posts tables.

-- ---------- Discussions ----------
CREATE TABLE IF NOT EXISTS public.community_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  replies_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_threads TO authenticated;
GRANT ALL ON public.community_threads TO service_role;
ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_threads readable" ON public.community_threads;
CREATE POLICY "community_threads readable" ON public.community_threads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_threads create" ON public.community_threads;
CREATE POLICY "community_threads create" ON public.community_threads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = community_threads.community_id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "community_threads manage" ON public.community_threads;
CREATE POLICY "community_threads manage" ON public.community_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS "community_threads delete" ON public.community_threads;
CREATE POLICY "community_threads delete" ON public.community_threads FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.community_thread_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.community_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.community_thread_replies TO authenticated;
GRANT ALL ON public.community_thread_replies TO service_role;
ALTER TABLE public.community_thread_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_thread_replies readable" ON public.community_thread_replies;
CREATE POLICY "community_thread_replies readable" ON public.community_thread_replies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_thread_replies create" ON public.community_thread_replies;
CREATE POLICY "community_thread_replies create" ON public.community_thread_replies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "community_thread_replies delete" ON public.community_thread_replies;
CREATE POLICY "community_thread_replies delete" ON public.community_thread_replies FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.community_thread_replies_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_threads SET replies_count = replies_count + 1 WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_threads SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS community_thread_replies_count ON public.community_thread_replies;
CREATE TRIGGER community_thread_replies_count AFTER INSERT OR DELETE ON public.community_thread_replies
FOR EACH ROW EXECUTE FUNCTION public.community_thread_replies_count_touch();

-- ---------- Find players (LFG) ----------
CREATE TABLE IF NOT EXISTS public.community_lfg_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  players_needed TEXT NOT NULL DEFAULT '1' CHECK (players_needed IN ('1','2','3+','team')),
  when_text TEXT NOT NULL DEFAULT 'now' CHECK (when_text IN ('now','1h','tonight','other')),
  mic_pref TEXT NOT NULL DEFAULT 'any' CHECK (mic_pref IN ('yes','no','any')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_lfg_posts TO authenticated;
GRANT ALL ON public.community_lfg_posts TO service_role;
ALTER TABLE public.community_lfg_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_lfg_posts readable" ON public.community_lfg_posts;
CREATE POLICY "community_lfg_posts readable" ON public.community_lfg_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_lfg_posts create" ON public.community_lfg_posts;
CREATE POLICY "community_lfg_posts create" ON public.community_lfg_posts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = community_lfg_posts.community_id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "community_lfg_posts manage" ON public.community_lfg_posts;
CREATE POLICY "community_lfg_posts manage" ON public.community_lfg_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "community_lfg_posts delete" ON public.community_lfg_posts;
CREATE POLICY "community_lfg_posts delete" ON public.community_lfg_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------- Events ----------
CREATE TABLE IF NOT EXISTS public.community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  capacity INT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_events TO authenticated;
GRANT ALL ON public.community_events TO service_role;
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_events readable" ON public.community_events;
CREATE POLICY "community_events readable" ON public.community_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_events create" ON public.community_events;
CREATE POLICY "community_events create" ON public.community_events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = community_events.community_id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "community_events manage" ON public.community_events;
CREATE POLICY "community_events manage" ON public.community_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS "community_events delete" ON public.community_events;
CREATE POLICY "community_events delete" ON public.community_events FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.community_event_rsvps (
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_event_rsvps TO authenticated;
GRANT ALL ON public.community_event_rsvps TO service_role;
ALTER TABLE public.community_event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_event_rsvps readable" ON public.community_event_rsvps;
CREATE POLICY "community_event_rsvps readable" ON public.community_event_rsvps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_event_rsvps write" ON public.community_event_rsvps;
CREATE POLICY "community_event_rsvps write" ON public.community_event_rsvps FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- Media ----------
CREATE TABLE IF NOT EXISTS public.community_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','video','clip','creation')),
  media_url TEXT NOT NULL,
  caption TEXT,
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.community_media TO authenticated;
GRANT ALL ON public.community_media TO service_role;
ALTER TABLE public.community_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_media readable" ON public.community_media;
CREATE POLICY "community_media readable" ON public.community_media FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_media create" ON public.community_media;
CREATE POLICY "community_media create" ON public.community_media FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = community_media.community_id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "community_media delete" ON public.community_media;
CREATE POLICY "community_media delete" ON public.community_media FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.community_media_likes (
  media_id UUID NOT NULL REFERENCES public.community_media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_media_likes TO authenticated;
GRANT ALL ON public.community_media_likes TO service_role;
ALTER TABLE public.community_media_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_media_likes readable" ON public.community_media_likes;
CREATE POLICY "community_media_likes readable" ON public.community_media_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_media_likes write" ON public.community_media_likes;
CREATE POLICY "community_media_likes write" ON public.community_media_likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.community_media_likes_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_media SET likes_count = likes_count + 1 WHERE id = NEW.media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_media SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS community_media_likes_count ON public.community_media_likes;
CREATE TRIGGER community_media_likes_count AFTER INSERT OR DELETE ON public.community_media_likes
FOR EACH ROW EXECUTE FUNCTION public.community_media_likes_count_touch();

-- ---------- XP / leaderboard ----------
CREATE TABLE IF NOT EXISTS public.community_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_xp_events TO authenticated;
GRANT ALL ON public.community_xp_events TO service_role;
ALTER TABLE public.community_xp_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_xp_events readable" ON public.community_xp_events;
CREATE POLICY "community_xp_events readable" ON public.community_xp_events FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS community_xp_events_lookup_idx ON public.community_xp_events(community_id, user_id, created_at);

CREATE OR REPLACE FUNCTION public.award_community_xp(_community UUID, _user UUID, _amount INT, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = _community AND user_id = _user) THEN
    RETURN;
  END IF;
  INSERT INTO public.community_xp_events (community_id, user_id, amount, reason)
  VALUES (_community, _user, _amount, _reason);
END; $$;
REVOKE ALL ON FUNCTION public.award_community_xp(UUID, UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.community_threads_award_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_community_xp(NEW.community_id, NEW.user_id, 15, 'thread');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS community_threads_xp ON public.community_threads;
CREATE TRIGGER community_threads_xp AFTER INSERT ON public.community_threads
FOR EACH ROW EXECUTE FUNCTION public.community_threads_award_xp();

CREATE OR REPLACE FUNCTION public.community_thread_replies_award_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID;
BEGIN
  SELECT community_id INTO _community FROM public.community_threads WHERE id = NEW.thread_id;
  IF _community IS NOT NULL THEN
    PERFORM public.award_community_xp(_community, NEW.user_id, 10, 'reply');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS community_thread_replies_xp ON public.community_thread_replies;
CREATE TRIGGER community_thread_replies_xp AFTER INSERT ON public.community_thread_replies
FOR EACH ROW EXECUTE FUNCTION public.community_thread_replies_award_xp();

CREATE OR REPLACE FUNCTION public.community_posts_award_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_community_xp(NEW.community_id, NEW.user_id, 15, 'post');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS community_posts_xp ON public.community_posts;
CREATE TRIGGER community_posts_xp AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_posts_award_xp();

CREATE OR REPLACE FUNCTION public.community_event_rsvps_award_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID;
BEGIN
  SELECT community_id INTO _community FROM public.community_events WHERE id = NEW.event_id;
  IF _community IS NOT NULL THEN
    PERFORM public.award_community_xp(_community, NEW.user_id, 25, 'event_rsvp');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS community_event_rsvps_xp ON public.community_event_rsvps;
CREATE TRIGGER community_event_rsvps_xp AFTER INSERT ON public.community_event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.community_event_rsvps_award_xp();

CREATE INDEX IF NOT EXISTS community_threads_community_idx ON public.community_threads(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_lfg_posts_community_idx ON public.community_lfg_posts(community_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_events_community_idx ON public.community_events(community_id, starts_at);
CREATE INDEX IF NOT EXISTS community_media_community_idx ON public.community_media(community_id, kind, created_at DESC);
