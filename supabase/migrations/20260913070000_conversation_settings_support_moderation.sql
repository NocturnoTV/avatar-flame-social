-- 1) Per-conversation participant settings: mute + pin.
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

-- 2) Bug reports (support page).
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','resolved','wont_fix')),
  page_url TEXT,
  handled_by UUID REFERENCES auth.users(id),
  handled_at TIMESTAMPTZ,
  moderator_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "create bug reports" ON public.bug_reports;
CREATE POLICY "create bug reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "read own bug reports" ON public.bug_reports;
CREATE POLICY "read own bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS "staff read bug reports" ON public.bug_reports;
CREATE POLICY "staff read bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff update bug reports" ON public.bug_reports;
CREATE POLICY "staff update bug reports" ON public.bug_reports FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 3) FAQ, admin-editable.
CREATE TABLE IF NOT EXISTS public.faq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_entries TO authenticated, anon;
GRANT ALL ON public.faq_entries TO service_role;
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "faq readable" ON public.faq_entries;
CREATE POLICY "faq readable" ON public.faq_entries FOR SELECT TO authenticated, anon USING (published);
DROP POLICY IF EXISTS "staff manage faq" ON public.faq_entries;
CREATE POLICY "staff manage faq" ON public.faq_entries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP TRIGGER IF EXISTS faq_touch ON public.faq_entries;
CREATE TRIGGER faq_touch BEFORE UPDATE ON public.faq_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) BloxSpark status, admin-editable single row.
CREATE TABLE IF NOT EXISTS public.service_status (
  id TEXT PRIMARY KEY DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational','degraded','outage')),
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.service_status (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.service_status TO authenticated, anon;
GRANT ALL ON public.service_status TO service_role;
ALTER TABLE public.service_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "status readable" ON public.service_status;
CREATE POLICY "status readable" ON public.service_status FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "staff update status" ON public.service_status;
CREATE POLICY "staff update status" ON public.service_status FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 5) Banned words list (admin-managed) + auto safety-alert on match.
CREATE TABLE IF NOT EXISTS public.banned_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','fr')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (word, language)
);
GRANT SELECT ON public.banned_words TO authenticated;
GRANT ALL ON public.banned_words TO service_role;
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage banned words" ON public.banned_words;
CREATE POLICY "staff manage banned words" ON public.banned_words FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.flag_message_for_safety(_conversation UUID, _sender UUID, _content TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _hit BOOLEAN; _other UUID;
BEGIN
  IF _content IS NULL OR length(trim(_content)) = 0 THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.banned_words w WHERE _content ~* ('\m' || w.word || '\M')
  ) INTO _hit;
  IF NOT _hit THEN RETURN; END IF;
  FOR _other IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = _conversation AND user_id <> _sender
  LOOP
    INSERT INTO public.notifications (user_id, kind, body, conversation_id)
    VALUES (_other, 'system', 'safety_alert', _conversation);
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.flag_message_for_safety(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.messages_safety_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.flag_message_for_safety(NEW.conversation_id, NEW.sender_id, NEW.content);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS messages_check_insults ON public.messages;
CREATE TRIGGER messages_check_insults AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_safety_check();

-- Also flag video comments the same way, notifying the video's owner.
CREATE OR REPLACE FUNCTION public.video_comments_safety_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _hit BOOLEAN; _owner UUID;
BEGIN
  IF NEW.content IS NULL OR length(trim(NEW.content)) = 0 THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.banned_words w WHERE NEW.content ~* ('\m' || w.word || '\M')
  ) INTO _hit;
  IF NOT _hit THEN RETURN NEW; END IF;
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, kind, body)
    VALUES (_owner, 'system', 'safety_alert');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS video_comments_check_insults ON public.video_comments;
CREATE TRIGGER video_comments_check_insults AFTER INSERT ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.video_comments_safety_check();

-- Seed a small starter list so the feature isn't empty out of the box;
-- admins can add/remove from /admin.
INSERT INTO public.banned_words (word, language) VALUES
  ('idiot', 'en'), ('stupid', 'en'), ('bastard', 'en'), ('whore', 'en'), ('slut', 'en'),
  ('retard', 'en'), ('faggot', 'en'), ('nigger', 'en'), ('kys', 'en'), ('kill yourself', 'en'),
  ('connard', 'fr'), ('connasse', 'fr'), ('salope', 'fr'), ('pute', 'fr'), ('enculé', 'fr'),
  ('batard', 'fr'), ('debile', 'fr'), ('abruti', 'fr')
ON CONFLICT (word, language) DO NOTHING;
