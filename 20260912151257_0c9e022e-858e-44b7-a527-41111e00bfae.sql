
-- ENUMS
CREATE TYPE public.swipe_action AS ENUM ('like','pass','super');
CREATE TYPE public.message_kind AS ENUM ('text','image','voice','system');
CREATE TYPE public.notification_kind AS ENUM ('match','message','like','super','system');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE,
  roblox_username TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  birth_date DATE,
  bio TEXT DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'dark',
  accent_color TEXT NOT NULL DEFAULT 'spark',
  banner_style TEXT NOT NULL DEFAULT 'nebula',
  frame_style TEXT NOT NULL DEFAULT 'none',
  sticker TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  parental_consent BOOLEAN NOT NULL DEFAULT false,
  parent_name TEXT,
  parent_email TEXT,
  username_changed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON public.blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a));
$$;

CREATE POLICY "profiles readable by members" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR NOT public.is_blocked(auth.uid(), id));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7 day username rule
CREATE OR REPLACE FUNCTION public.enforce_username_cooldown()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username AND OLD.username IS NOT NULL THEN
    IF OLD.username_changed_at IS NOT NULL AND OLD.username_changed_at > now() - interval '7 days' THEN
      RAISE EXCEPTION 'username_cooldown';
    END IF;
    NEW.username_changed_at = now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_username_cooldown BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_username_cooldown();

-- PHOTOS
CREATE TABLE public.profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_photos TO authenticated;
GRANT ALL ON public.profile_photos TO service_role;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos readable" ON public.profile_photos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), user_id));
CREATE POLICY "manage own photos" ON public.profile_photos FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_conversation UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conversation AND user_id = _user);
$$;

CREATE POLICY "members read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_member(id, auth.uid()));
CREATE POLICY "create conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "members update conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_member(id, auth.uid())) WITH CHECK (public.is_member(id, auth.uid()));

CREATE POLICY "read participants" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "add participants" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_member(conversation_id, auth.uid()));
CREATE POLICY "update own participation" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "leave conversation" ON public.conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind public.message_kind NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_member(conversation_id, auth.uid()));
CREATE POLICY "delete own messages" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

-- SWIPES & MATCHES
CREATE TABLE public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  action public.swipe_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (swiper_id, target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swipes TO authenticated;
GRANT ALL ON public.swipes TO service_role;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own swipes" ON public.swipes FOR ALL TO authenticated
  USING (swiper_id = auth.uid()) WITH CHECK (swiper_id = auth.uid());

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own matches" ON public.matches FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind public.notification_kind NOT NULL,
  actor_id UUID REFERENCES auth.users ON DELETE CASCADE,
  body TEXT,
  conversation_id UUID REFERENCES public.conversations ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- notify on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, actor_id, body, conversation_id)
  SELECT p.user_id, 'message', NEW.sender_id, LEFT(COALESCE(NEW.content, ''), 120), NEW.conversation_id
  FROM public.conversation_participants p
  WHERE p.conversation_id = NEW.conversation_id AND p.user_id <> NEW.sender_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "read own reports" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());

-- SWIPE RPC (handles match + conversation creation)
CREATE OR REPLACE FUNCTION public.perform_swipe(_target UUID, _action public.swipe_action)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me UUID := auth.uid();
  _reciprocal BOOLEAN;
  _conv UUID;
  _a UUID; _b UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _me = _target THEN RAISE EXCEPTION 'self_swipe'; END IF;

  INSERT INTO public.swipes (swiper_id, target_id, action)
  VALUES (_me, _target, _action)
  ON CONFLICT (swiper_id, target_id) DO UPDATE SET action = EXCLUDED.action, created_at = now();

  IF _action = 'pass' THEN RETURN jsonb_build_object('match', false); END IF;

  SELECT EXISTS (SELECT 1 FROM public.swipes WHERE swiper_id = _target AND target_id = _me AND action IN ('like','super'))
  INTO _reciprocal;

  IF NOT _reciprocal THEN
    INSERT INTO public.notifications (user_id, kind, actor_id)
    VALUES (_target, CASE WHEN _action = 'super' THEN 'super'::public.notification_kind ELSE 'like'::public.notification_kind END, _me);
    RETURN jsonb_build_object('match', false);
  END IF;

  _a := LEAST(_me, _target); _b := GREATEST(_me, _target);

  SELECT conversation_id INTO _conv FROM public.matches WHERE user_a = _a AND user_b = _b;
  IF _conv IS NULL THEN
    INSERT INTO public.conversations (is_group, created_by) VALUES (false, _me) RETURNING id INTO _conv;
    INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (_conv, _me), (_conv, _target);
    INSERT INTO public.matches (user_a, user_b, conversation_id) VALUES (_a, _b, _conv)
    ON CONFLICT (user_a, user_b) DO UPDATE SET conversation_id = EXCLUDED.conversation_id;
    INSERT INTO public.notifications (user_id, kind, actor_id, conversation_id)
    VALUES (_target, 'match', _me, _conv), (_me, 'match', _target, _conv);
  END IF;

  RETURN jsonb_build_object('match', true, 'conversation_id', _conv);
END; $$;
GRANT EXECUTE ON FUNCTION public.perform_swipe(UUID, public.swipe_action) TO authenticated;

-- Deck RPC: profiles not yet swiped, not blocked
CREATE OR REPLACE FUNCTION public.spark_deck(_limit INT DEFAULT 20, _lang TEXT DEFAULT NULL, _min_age INT DEFAULT 13, _max_age INT DEFAULT 99)
RETURNS SETOF public.profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND p.onboarding_completed
    AND NOT public.is_blocked(auth.uid(), p.id)
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = auth.uid() AND s.target_id = p.id)
    AND (_lang IS NULL OR p.language = _lang)
    AND (p.birth_date IS NULL OR EXTRACT(YEAR FROM age(p.birth_date)) BETWEEN _min_age AND _max_age)
  ORDER BY p.last_active_at DESC
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.spark_deck(INT, TEXT, INT, INT) TO authenticated;

-- Group creation RPC
CREATE OR REPLACE FUNCTION public.create_group(_name TEXT, _members UUID[])
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me UUID := auth.uid(); _conv UUID; _m UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.conversations (is_group, name, created_by) VALUES (true, _name, _me) RETURNING id INTO _conv;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (_conv, _me);
  FOREACH _m IN ARRAY COALESCE(_members, ARRAY[]::UUID[]) LOOP
    IF _m <> _me THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (_conv, _m) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN _conv;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, UUID[]) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
