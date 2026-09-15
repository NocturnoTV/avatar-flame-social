-- Daily quest rewards now require an explicit "Claim" tap instead of being
-- credited the instant progress hits the target: reaching the target only
-- flips `completed`, and claim_daily_quest() (called when the player taps
-- Claim) is what actually credits the Blox reward and updates the streak.

alter table public.user_daily_quests add column if not exists claimed boolean not null default false;
alter table public.user_daily_quests add column if not exists claimed_at timestamptz;

create or replace function public.bump_quest_progress_for(_user uuid, _metric_key text, _entity_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _tz text;
  _today date;
  _row public.user_daily_quests;
begin
  select coalesce(timezone, 'UTC') into _tz from public.profiles where id = _user;
  if _tz is null then return; end if;
  _today := (now() at time zone _tz)::date;

  perform public.ensure_daily_quests_for(_user, _today);

  insert into public.user_daily_quest_progress_items (user_id, quest_date, quest_key, entity_id)
  values (_user, _today, _metric_key, _entity_id)
  on conflict do nothing;
  if not found then return; end if;

  update public.user_daily_quests
  set progress = least(target, progress + 1)
  where user_id = _user and quest_date = _today and quest_key = _metric_key and not completed
  returning * into _row;

  if _row.id is null or _row.progress < _row.target then return; end if;

  update public.user_daily_quests set completed = true, completed_at = now() where id = _row.id;
end;
$function$;

create or replace function public.claim_daily_quest(_quest_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _row public.user_daily_quests;
  _new_streak integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into _row from public.user_daily_quests
  where id = _quest_id and user_id = auth.uid()
  for update;

  if _row.id is null then raise exception 'quest_not_found'; end if;
  if not _row.completed then raise exception 'quest_not_completed'; end if;
  if _row.claimed then raise exception 'quest_already_claimed'; end if;

  update public.user_daily_quests set claimed = true, claimed_at = now() where id = _row.id;

  update public.profiles set blox_balance = blox_balance + _row.reward_blox where id = auth.uid();
  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (auth.uid(), _row.reward_blox, 'quest_reward', _row.quest_key, 'Défi quotidien');

  select case
    when last_completed_date = _row.quest_date then current_streak
    when last_completed_date = _row.quest_date - 1 then current_streak + 1
    else 1
  end into _new_streak
  from public.user_quest_streaks where user_id = auth.uid();
  _new_streak := coalesce(_new_streak, 1);

  insert into public.user_quest_streaks (user_id, current_streak, longest_streak, last_completed_date)
  values (auth.uid(), _new_streak, _new_streak, _row.quest_date)
  on conflict (user_id) do update set
    current_streak = _new_streak,
    longest_streak = greatest(public.user_quest_streaks.longest_streak, _new_streak),
    last_completed_date = _row.quest_date;
end;
$function$;
