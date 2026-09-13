-- Message requests: a new 1:1 conversation started with someone you're not
-- matched with sits as "pending" until the recipient approves it, Instagram
-- DM-request style. Matches and groups stay auto-accepted.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (request_status IN ('pending','accepted','declined'));

CREATE OR REPLACE FUNCTION public.start_direct_message(_target UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me UUID := auth.uid();
  _conv UUID;
  _matched BOOLEAN;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _me = _target THEN RAISE EXCEPTION 'self_message'; END IF;
  IF public.is_blocked(_me, _target) THEN RAISE EXCEPTION 'blocked'; END IF;

  SELECT c.id INTO _conv
  FROM public.conversations c
  WHERE c.is_group = false
    AND EXISTS (SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = _target)
  LIMIT 1;

  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE (m.user_a = _me AND m.user_b = _target) OR (m.user_a = _target AND m.user_b = _me)
  ) INTO _matched;

  INSERT INTO public.conversations (is_group, created_by, request_status)
  VALUES (false, _me, CASE WHEN _matched THEN 'accepted' ELSE 'pending' END)
  RETURNING id INTO _conv;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (_conv, _me), (_conv, _target);
  RETURN _conv;
END; $$;
REVOKE ALL ON FUNCTION public.start_direct_message(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_message(UUID) TO authenticated;
