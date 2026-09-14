-- Real Blox-funded video boost: spends Blox, sets an expiry, and the feed
-- can show a "🚀 Boostée" badge while active. Boosting only ever increases
-- visibility weighting elsewhere in the app - it must never fabricate
-- likes, views, or followers.
alter table public.videos add column if not exists boosted_until timestamptz;

create or replace function public.boost_video(_video uuid, _blox_cost integer, _hours integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _user uuid := auth.uid();
  _owner uuid;
  _balance integer;
  _current_boost timestamptz;
  _base timestamptz;
begin
  if _user is null then raise exception 'not_authenticated'; end if;
  if _blox_cost <= 0 or _hours <= 0 then raise exception 'invalid_boost'; end if;

  select user_id, boosted_until into _owner, _current_boost from public.videos where id = _video;
  if _owner is null then raise exception 'video_not_found'; end if;
  if _owner <> _user then raise exception 'not_your_video'; end if;

  select blox_balance into _balance from public.profiles where id = _user for update;
  if _balance is null or _balance < _blox_cost then raise exception 'insufficient_balance'; end if;

  -- Stacks onto time remaining on an existing boost instead of overwriting it.
  _base := greatest(coalesce(_current_boost, now()), now());

  update public.profiles set blox_balance = blox_balance - _blox_cost where id = _user;
  update public.videos set boosted_until = _base + make_interval(hours => _hours) where id = _video;
  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (_user, -_blox_cost, 'purchase', _video::text, 'Boost vidéo (' || _hours || 'h)');
end;
$$;

grant execute on function public.boost_video(uuid, integer, integer) to authenticated;
