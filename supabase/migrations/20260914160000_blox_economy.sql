-- Blox virtual currency: wallet, ledger, Blox Store badges, daily quests +
-- streaks, opt-in watch history, and the profile-visit log the "Explorer"
-- quest counts against. See src/lib/dailyQuests.ts and src/lib/bloxPacks.ts
-- for the client-side catalogs that mirror the constants embedded below.

alter table public.profiles
  add column if not exists blox_balance integer not null default 0,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists watch_history_enabled boolean not null default false;

-- blox_balance must never move except through the SECURITY DEFINER functions
-- below (gift_blox, purchase_badge, quest rewards, the webhook's pack
-- credit). RLS on profiles only checks `id = auth.uid()`, which would
-- otherwise let any signed-in client UPDATE their own balance directly.
-- Functions created by this migration are owned by `postgres`, so
-- current_user is `postgres` while they run; the payments webhook writes
-- directly via the service-role key, which PostgREST executes as
-- `service_role`. Direct client calls run as `authenticated` and get
-- rejected here instead.
create or replace function public.protect_blox_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.blox_balance is distinct from old.blox_balance
     and current_user not in ('postgres', 'service_role') then
    raise exception 'blox_balance can only change via server-side functions';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_blox_balance_trigger on public.profiles;
create trigger protect_blox_balance_trigger
before update on public.profiles
for each row execute function public.protect_blox_balance();

create table if not exists public.blox_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('purchase','gift_sent','gift_received','quest_reward','badge_purchase','refund')),
  reference_id text,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists blox_transactions_user_idx on public.blox_transactions(user_id, created_at desc);
alter table public.blox_transactions enable row level security;
drop policy if exists "blox_transactions_select_own" on public.blox_transactions;
create policy "blox_transactions_select_own" on public.blox_transactions for select using (auth.uid() = user_id);

-- ===== Blox Store: cosmetic badges =====
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  emoji text not null,
  price_blox integer not null check (price_blox >= 0),
  rarity text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.badges enable row level security;
drop policy if exists "badges_select_active" on public.badges;
create policy "badges_select_active" on public.badges for select using (active = true);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  equipped boolean not null default true,
  acquired_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.user_badges enable row level security;
drop policy if exists "user_badges_select_all" on public.user_badges;
create policy "user_badges_select_all" on public.user_badges for select using (true);
drop policy if exists "user_badges_update_own" on public.user_badges;
create policy "user_badges_update_own" on public.user_badges for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.badges (key, name, emoji, price_blox, rarity, position) values
  ('early_spark', 'Early Spark', '🌟', 500, 'common', 1),
  ('fire_starter', 'Fire Starter', '🔥', 800, 'common', 2),
  ('night_owl', 'Night Owl', '🌙', 900, 'common', 3),
  ('pro_gamer', 'Pro Gamer', '🎮', 1200, 'rare', 4),
  ('artist', 'Artist', '🎨', 1200, 'rare', 5),
  ('lightning', 'Lightning', '⚡', 1800, 'rare', 6),
  ('unicorn', 'Unicorn', '🦄', 2500, 'epic', 7),
  ('rocket', 'Rocket', '🚀', 2500, 'epic', 8),
  ('diamond', 'Diamond', '💎', 4000, 'epic', 9),
  ('vip_crown', 'VIP', '👑', 6000, 'legendary', 10)
on conflict (key) do nothing;

-- ===== Daily quests + streaks =====
create table if not exists public.user_daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_date date not null,
  quest_key text not null,
  target integer not null,
  reward_blox integer not null,
  progress integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, quest_date, quest_key)
);
create index if not exists user_daily_quests_lookup on public.user_daily_quests(user_id, quest_date);
alter table public.user_daily_quests enable row level security;
drop policy if exists "user_daily_quests_select_own" on public.user_daily_quests;
create policy "user_daily_quests_select_own" on public.user_daily_quests for select using (auth.uid() = user_id);

create table if not exists public.user_daily_quest_progress_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_date date not null,
  quest_key text not null,
  entity_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, quest_date, quest_key, entity_id)
);
alter table public.user_daily_quest_progress_items enable row level security;
drop policy if exists "user_daily_quest_progress_items_select_own" on public.user_daily_quest_progress_items;
create policy "user_daily_quest_progress_items_select_own" on public.user_daily_quest_progress_items for select using (auth.uid() = user_id);

create table if not exists public.user_quest_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed_date date
);
alter table public.user_quest_streaks enable row level security;
drop policy if exists "user_quest_streaks_select_own" on public.user_quest_streaks;
create policy "user_quest_streaks_select_own" on public.user_quest_streaks for select using (auth.uid() = user_id);

-- ===== Explorer quest: distinct profile visits per local day =====
create table if not exists public.profile_visits (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  visited_id uuid not null references public.profiles(id) on delete cascade,
  visited_date date not null,
  created_at timestamptz not null default now(),
  primary key (viewer_id, visited_id, visited_date)
);
alter table public.profile_visits enable row level security;
drop policy if exists "profile_visits_select_own" on public.profile_visits;
create policy "profile_visits_select_own" on public.profile_visits for select using (auth.uid() = viewer_id);
drop policy if exists "profile_visits_insert_own" on public.profile_visits;
create policy "profile_visits_insert_own" on public.profile_visits for insert with check (auth.uid() = viewer_id);

-- ===== Opt-in watch history ("Recents") =====
-- Separate from video_watch_events (which always records for the recommender
-- regardless of this setting) - this one only gets written to when the
-- viewer has explicitly turned watch_history_enabled on.
create table if not exists public.watch_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  watched_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index if not exists watch_history_user_idx on public.watch_history(user_id, watched_at desc);
alter table public.watch_history enable row level security;
drop policy if exists "watch_history_select_own" on public.watch_history;
create policy "watch_history_select_own" on public.watch_history for select using (auth.uid() = user_id);
drop policy if exists "watch_history_insert_own" on public.watch_history;
create policy "watch_history_insert_own" on public.watch_history for insert with check (auth.uid() = user_id);
drop policy if exists "watch_history_update_own" on public.watch_history;
create policy "watch_history_update_own" on public.watch_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "watch_history_delete_own" on public.watch_history;
create policy "watch_history_delete_own" on public.watch_history for delete using (auth.uid() = user_id);

-- ===== RPCs =====

create or replace function public.ensure_daily_quests_for(_user uuid, _today date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.user_daily_quests where user_id = _user and quest_date = _today) then
    return;
  end if;

  insert into public.user_daily_quests (user_id, quest_date, quest_key, target, reward_blox)
  select _user, _today, key, target, reward
  from (
    values
      ('social_spark', 10, 30),
      ('conversation', 3, 40),
      ('creator', 1, 50),
      ('explorer', 10, 25),
      ('community', 3, 40),
      ('make_a_friend', 1, 35),
      ('share_it', 2, 30),
      ('content_time', 5, 30),
      ('show_some_love', 5, 25),
      ('daily_visit', 1, 15)
  ) as catalog(key, target, reward)
  order by random()
  limit 3
  on conflict (user_id, quest_date, quest_key) do nothing;
end;
$$;

create or replace function public.ensure_daily_quests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tz text;
  _today date;
begin
  if auth.uid() is null then return; end if;
  select coalesce(timezone, 'UTC') into _tz from public.profiles where id = auth.uid();
  _today := (now() at time zone coalesce(_tz, 'UTC'))::date;
  perform public.ensure_daily_quests_for(auth.uid(), _today);
end;
$$;

-- Core progress bump, keyed on an explicit user so server-side callers
-- (the recommendation engine's watch-completion tracker, the payments
-- webhook) can drive it too, alongside the client-facing wrapper below.
create or replace function public.bump_quest_progress_for(_user uuid, _metric_key text, _entity_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tz text;
  _today date;
  _row public.user_daily_quests;
  _new_streak integer;
begin
  select coalesce(timezone, 'UTC') into _tz from public.profiles where id = _user;
  if _tz is null then return; end if;
  _today := (now() at time zone _tz)::date;

  perform public.ensure_daily_quests_for(_user, _today);

  -- Dedup so re-liking/re-visiting the same thing can't farm progress.
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

  update public.profiles set blox_balance = blox_balance + _row.reward_blox where id = _user;
  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (_user, _row.reward_blox, 'quest_reward', _row.quest_key, 'Défi quotidien');

  select case
    when last_completed_date = _today then current_streak
    when last_completed_date = _today - 1 then current_streak + 1
    else 1
  end into _new_streak
  from public.user_quest_streaks where user_id = _user;
  _new_streak := coalesce(_new_streak, 1);

  insert into public.user_quest_streaks (user_id, current_streak, longest_streak, last_completed_date)
  values (_user, _new_streak, _new_streak, _today)
  on conflict (user_id) do update set
    current_streak = _new_streak,
    longest_streak = greatest(public.user_quest_streaks.longest_streak, _new_streak),
    last_completed_date = _today;
end;
$$;

create or replace function public.bump_quest_progress(_metric_key text, _entity_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform public.bump_quest_progress_for(auth.uid(), _metric_key, _entity_id);
end;
$$;

create or replace function public.gift_blox(_to_user uuid, _amount integer, _message text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _from uuid := auth.uid();
  _balance integer;
begin
  if _from is null then raise exception 'not_authenticated'; end if;
  if _amount is null or _amount <= 0 then raise exception 'invalid_amount'; end if;
  if _to_user = _from then raise exception 'cannot_gift_self'; end if;
  if not exists (select 1 from public.follows where follower_id = _from and following_id = _to_user) then
    raise exception 'not_a_friend';
  end if;

  select blox_balance into _balance from public.profiles where id = _from for update;
  if _balance is null or _balance < _amount then raise exception 'insufficient_balance'; end if;

  update public.profiles set blox_balance = blox_balance - _amount where id = _from;
  update public.profiles set blox_balance = blox_balance + _amount where id = _to_user;

  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (_from, -_amount, 'gift_sent', _to_user::text, _message);
  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (_to_user, _amount, 'gift_received', _from::text, _message);
end;
$$;

create or replace function public.purchase_badge(_badge uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _user uuid := auth.uid();
  _price integer;
  _balance integer;
begin
  if _user is null then raise exception 'not_authenticated'; end if;

  select price_blox into _price from public.badges where id = _badge and active = true;
  if _price is null then raise exception 'badge_not_found'; end if;

  if exists (select 1 from public.user_badges where user_id = _user and badge_id = _badge) then
    raise exception 'already_owned';
  end if;

  select blox_balance into _balance from public.profiles where id = _user for update;
  if _balance is null or _balance < _price then raise exception 'insufficient_balance'; end if;

  update public.profiles set blox_balance = blox_balance - _price where id = _user;
  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (_user, -_price, 'badge_purchase', _badge::text, 'Badge acheté');
  insert into public.user_badges (user_id, badge_id, equipped) values (_user, _badge, true);
end;
$$;

create or replace function public.toggle_badge_equipped(_badge uuid, _equipped boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update public.user_badges set equipped = _equipped
  where user_id = auth.uid() and badge_id = _badge;
end;
$$;

grant execute on function public.ensure_daily_quests() to authenticated;
grant execute on function public.ensure_daily_quests_for(uuid, date) to authenticated;
grant execute on function public.bump_quest_progress(text, text) to authenticated;
grant execute on function public.bump_quest_progress_for(uuid, text, text) to authenticated;
grant execute on function public.gift_blox(uuid, integer, text) to authenticated;
grant execute on function public.purchase_badge(uuid) to authenticated;
grant execute on function public.toggle_badge_equipped(uuid, boolean) to authenticated;
