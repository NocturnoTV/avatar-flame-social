-- Sponsored video campaigns: a creator spends Blox to buy extra distribution
-- for a video, with real objectives/targeting/spend-tracking instead of the
-- flat "pay X, get boosted Y hours" tier system (boost_video/videos.boosted_until,
-- kept as-is for creators who just want a quick, simple bump).
create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null check (objective in ('views', 'game_clicks', 'followers', 'engagement')),
  game_url text,
  budget_blox integer not null check (budget_blox > 0),
  spent_blox integer not null default 0 check (spent_blox >= 0),
  duration_days integer not null check (duration_days between 1 and 7),
  target_language text,
  target_categories text[],
  status text not null default 'active' check (status in ('active', 'completed', 'removed')),
  stop_reason text,
  created_at timestamptz not null default now(),
  ends_at timestamptz not null
);
create index ad_campaigns_active_idx on public.ad_campaigns(status, ends_at) where status = 'active';
create index ad_campaigns_user_idx on public.ad_campaigns(user_id);

alter table public.ad_campaigns enable row level security;
grant select, insert on public.ad_campaigns to authenticated;
grant all on public.ad_campaigns to service_role;
create policy "ad_campaigns_select_own" on public.ad_campaigns for select to authenticated
  using (user_id = auth.uid());
-- Row creation and every state change (spend, completion, removal) goes
-- through security-definer RPCs below, which validate ownership/balance/
-- price server-side - there is no direct insert/update policy for clients.

create table public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete set null,
  cost_blox integer not null,
  created_at timestamptz not null default now()
);
create index ad_impressions_campaign_idx on public.ad_impressions(campaign_id);

alter table public.ad_impressions enable row level security;
grant select on public.ad_impressions to authenticated;
grant all on public.ad_impressions to service_role;
create policy "ad_impressions_select_own_campaign" on public.ad_impressions for select to authenticated
  using (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid()));

-- Fixed, server-side price - the client only ever proposes a total budget.
create or replace function public.ad_cost_per_impression() returns integer
language sql immutable as $$ select 2 $$;

create or replace function public.create_ad_campaign(
  _video uuid,
  _objective text,
  _game_url text,
  _budget integer,
  _duration_days integer,
  _target_language text,
  _target_categories text[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _user uuid := auth.uid();
  _owner uuid;
  _balance integer;
  _campaign uuid;
begin
  if _user is null then raise exception 'not_authenticated'; end if;
  if _objective not in ('views','game_clicks','followers','engagement') then raise exception 'invalid_objective'; end if;
  if _objective = 'game_clicks' and (_game_url is null or _game_url = '') then raise exception 'game_url_required'; end if;
  if _budget < 100 then raise exception 'budget_too_low'; end if;
  if _duration_days < 1 or _duration_days > 7 then raise exception 'invalid_duration'; end if;

  select user_id into _owner from public.videos where id = _video;
  if _owner is null then raise exception 'video_not_found'; end if;
  if _owner <> _user then raise exception 'not_your_video'; end if;

  select blox_balance into _balance from public.profiles where id = _user for update;
  if _balance is null or _balance < _budget then raise exception 'insufficient_balance'; end if;

  update public.profiles set blox_balance = blox_balance - _budget where id = _user;
  insert into public.ad_campaigns (
    video_id, user_id, objective, game_url, budget_blox, duration_days,
    target_language, target_categories, ends_at
  ) values (
    _video, _user, _objective, nullif(_game_url, ''), _budget, _duration_days,
    nullif(_target_language, ''), nullif(_target_categories, '{}'::text[]),
    now() + make_interval(days => _duration_days)
  ) returning id into _campaign;

  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (_user, -_budget, 'purchase', _campaign::text, 'Campagne sponsorisée');

  return _campaign;
end;
$$;
grant execute on function public.create_ad_campaign(uuid, text, text, integer, integer, text, text[]) to authenticated;

-- Refunds whatever's left of a campaign's budget and closes it out - shared
-- by natural completion (budget/duration exhausted), the creator stopping
-- it early, and moderation removal.
create or replace function public.close_ad_campaign(_campaign uuid, _status text, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _row public.ad_campaigns;
begin
  select * into _row from public.ad_campaigns where id = _campaign for update;
  if _row.id is null or _row.status <> 'active' then return; end if;

  update public.ad_campaigns set status = _status, stop_reason = _reason where id = _campaign;

  if _row.budget_blox > _row.spent_blox then
    update public.profiles set blox_balance = blox_balance + (_row.budget_blox - _row.spent_blox)
      where id = _row.user_id;
    insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
    values (_row.user_id, _row.budget_blox - _row.spent_blox, 'refund', _campaign::text, 'Reliquat campagne sponsorisée');
  end if;
end;
$$;

create or replace function public.stop_ad_campaign(_campaign uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ad_campaigns where id = _campaign and user_id = auth.uid()) then
    raise exception 'not_your_campaign';
  end if;
  perform public.close_ad_campaign(_campaign, 'completed', 'stopped_by_creator');
end;
$$;
grant execute on function public.stop_ad_campaign(uuid) to authenticated;

-- Called once per real viewer impression of a sponsored video (see the
-- recommendation engine change) - never trusts a client-supplied cost.
create or replace function public.charge_ad_impression(_campaign uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _row public.ad_campaigns; _cost integer := public.ad_cost_per_impression();
begin
  select * into _row from public.ad_campaigns where id = _campaign for update;
  if _row.id is null or _row.status <> 'active' then return; end if;
  if _row.ends_at <= now() then
    perform public.close_ad_campaign(_campaign, 'completed', 'duration_expired');
    return;
  end if;

  insert into public.ad_impressions (campaign_id, viewer_id, cost_blox)
  values (_campaign, auth.uid(), _cost);
  update public.ad_campaigns set spent_blox = spent_blox + _cost where id = _campaign;

  if _row.spent_blox + _cost >= _row.budget_blox then
    perform public.close_ad_campaign(_campaign, 'completed', 'budget_exhausted');
  end if;
end;
$$;
grant execute on function public.charge_ad_impression(uuid) to authenticated;

-- Best-effort lazy cleanup (no cron infra in this project - same pattern
-- already used for Story expiry): closes+refunds the caller's own active
-- campaigns whose duration has elapsed. Called when the creator opens
-- their campaigns list.
create or replace function public.close_my_expired_ad_campaigns()
returns void language plpgsql security definer set search_path = public as $$
declare _c record;
begin
  for _c in
    select id from public.ad_campaigns
    where user_id = auth.uid() and status = 'active' and ends_at <= now()
  loop
    perform public.close_ad_campaign(_c.id, 'completed', 'duration_expired');
  end loop;
end;
$$;
grant execute on function public.close_my_expired_ad_campaigns() to authenticated;

-- A video rejected by moderation while sponsored is pulled immediately,
-- with whatever budget is left refunded - never left running.
create or replace function public.remove_ad_campaigns_for_rejected_video()
returns trigger language plpgsql security definer set search_path = public as $$
declare _c record;
begin
  if new.moderation_status = 'rejected' and old.moderation_status is distinct from 'rejected' then
    for _c in select id from public.ad_campaigns where video_id = new.id and status = 'active' loop
      perform public.close_ad_campaign(_c.id, 'removed', 'video_rejected');
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_remove_ad_campaigns_for_rejected_video on public.videos;
create trigger trg_remove_ad_campaigns_for_rejected_video
  after update on public.videos
  for each row execute function public.remove_ad_campaigns_for_rejected_video();
