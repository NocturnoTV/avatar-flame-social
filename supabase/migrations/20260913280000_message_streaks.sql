-- Message streaks: 🔥 +1 per day two people (1:1 conversation) both send a message.

ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS last_message_date date;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS streak_date date;

CREATE OR REPLACE FUNCTION public.bump_message_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'utc')::date;
  convo_is_group boolean;
  convo_streak int;
  convo_streak_date date;
  other_active_today boolean;
BEGIN
  IF NEW.kind = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT c.is_group, c.streak_count, c.streak_date
  INTO convo_is_group, convo_streak, convo_streak_date
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  -- Streaks only apply to 1:1 conversations.
  IF convo_is_group IS NOT FALSE THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversation_participants
  SET last_message_date = today
  WHERE conversation_id = NEW.conversation_id
    AND user_id = NEW.sender_id
    AND last_message_date IS DISTINCT FROM today;

  -- Already credited today.
  IF convo_streak_date = today THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
      AND last_message_date = today
  ) INTO other_active_today;

  IF NOT other_active_today THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversations
  SET streak_count = CASE WHEN convo_streak_date = today - 1 THEN convo_streak + 1 ELSE 1 END,
      streak_date = today
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_streak ON public.messages;
CREATE TRIGGER messages_bump_streak
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_message_streak();
