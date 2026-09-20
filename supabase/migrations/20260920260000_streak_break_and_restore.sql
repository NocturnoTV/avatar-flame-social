-- Streaks used to silently reset to 1 when a day was missed. Now a lost
-- streak freezes instead (streak_count/streak_date stay put) and needs an
-- explicit restore within 30h, gated behind Spark Plus (max 3/month) -
-- otherwise it's cleared for good the next time either side messages.
alter table public.conversations add column streak_broken_at timestamptz;

create table public.streak_restores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index streak_restores_user_id_idx on public.streak_restores(user_id, created_at);
alter table public.streak_restores enable row level security;
create policy "user reads own streak restores" on public.streak_restores
  for select using (user_id = auth.uid());

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

  -- A broken streak that nobody restored within 30h of breaking is gone
  -- for good - clear it so this message can start counting fresh instead
  -- of staying stuck showing a stale broken state forever.
  IF convo_broken_at IS NOT NULL AND now() - convo_broken_at > interval '30 hours' THEN
    convo_streak := 0;
    convo_streak_date := NULL;
    convo_broken_at := NULL;
    UPDATE public.conversations
    SET streak_count = 0, streak_date = NULL, streak_broken_at = NULL
    WHERE id = NEW.conversation_id;
  END IF;

  IF convo_broken_at IS NOT NULL THEN
    -- Still within the restore window - frozen, a message alone doesn't
    -- revive it (only restore_streak does).
    RETURN NEW;
  END IF;

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

  IF convo_streak_date = today - 1 THEN
    UPDATE public.conversations
    SET streak_count = convo_streak + 1, streak_date = today
    WHERE id = NEW.conversation_id;
  ELSIF convo_streak > 0 THEN
    -- They had a streak going but missed the grace day entirely (more than
    -- one day since the last shared day) - freeze it as broken instead of
    -- silently resetting, so it can be explicitly restored.
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

create or replace function public.restore_streak(_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _user uuid := auth.uid();
  _is_participant boolean;
  _streak_count int;
  _broken_at timestamptz;
  _spark_plus boolean;
  _restores_this_month int;
begin
  if _user is null then raise exception 'not_authenticated'; end if;

  select exists (
    select 1 from public.conversation_participants
    where conversation_id = _conversation_id and user_id = _user
  ) into _is_participant;
  if not _is_participant then raise exception 'forbidden'; end if;

  select streak_count, streak_broken_at into _streak_count, _broken_at
    from public.conversations where id = _conversation_id for update;
  if _broken_at is null then raise exception 'not_broken'; end if;
  if now() - _broken_at > interval '30 hours' then raise exception 'restore_window_expired'; end if;

  select spark_plus_active into _spark_plus from public.profiles where id = _user;
  if not coalesce(_spark_plus, false) then raise exception 'requires_spark_plus'; end if;

  select count(*) into _restores_this_month
    from public.streak_restores
    where user_id = _user and created_at >= date_trunc('month', now());
  if _restores_this_month >= 3 then raise exception 'monthly_limit_reached'; end if;

  update public.conversations
    set streak_broken_at = null,
        streak_date = (now() at time zone 'utc')::date - 1
    where id = _conversation_id;

  insert into public.streak_restores (user_id, conversation_id) values (_user, _conversation_id);

  return _streak_count;
end;
$$;
