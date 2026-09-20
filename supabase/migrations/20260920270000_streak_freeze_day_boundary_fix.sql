-- Streaks were freezing (showing gray) for people chatting every day, just
-- because "both sides active today" required an exact UTC calendar-day
-- match. Anyone messaging near UTC midnight (e.g. late evening in France,
-- UTC+1/+2) can land on either side of that boundary depending on the
-- minute, making the other side look "inactive today" even though they
-- messaged within the last few hours. Widen the mutual-activity check to
-- "today or yesterday" so day-boundary timing drift no longer trips a
-- false freeze - a real 2+ day gap still freezes as before.
create or replace function public.bump_message_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  today date := (now() AT TIME ZONE 'utc')::date;
  convo_is_group boolean;
  convo_streak int;
  convo_streak_date date;
  convo_broken_at timestamptz;
  other_active_today boolean;
BEGIN
  IF NEW.kind = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT c.is_group, c.streak_count, c.streak_date, c.streak_broken_at
  INTO convo_is_group, convo_streak, convo_streak_date, convo_broken_at
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  IF convo_is_group IS NOT FALSE THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversation_participants
  SET last_message_date = today
  WHERE conversation_id = NEW.conversation_id
    AND user_id = NEW.sender_id
    AND last_message_date IS DISTINCT FROM today;

  IF convo_broken_at IS NOT NULL AND now() - convo_broken_at > interval '30 hours' THEN
    convo_streak := 0;
    convo_streak_date := NULL;
    convo_broken_at := NULL;
    UPDATE public.conversations
    SET streak_count = 0, streak_date = NULL, streak_broken_at = NULL
    WHERE id = NEW.conversation_id;
  END IF;

  IF convo_broken_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF convo_streak_date = today THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
      AND last_message_date >= today - 1
  ) INTO other_active_today;

  IF NOT other_active_today THEN
    RETURN NEW;
  END IF;

  IF convo_streak_date >= today - 1 THEN
    UPDATE public.conversations
    SET streak_count = convo_streak + 1, streak_date = today
    WHERE id = NEW.conversation_id;
  ELSIF convo_streak > 0 THEN
    UPDATE public.conversations
    SET streak_broken_at = now()
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.conversations
    SET streak_count = 1, streak_date = today
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;
