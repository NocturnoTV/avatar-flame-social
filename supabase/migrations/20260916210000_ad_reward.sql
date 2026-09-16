-- Rewarded-ad Blox claim: one column to track the cooldown, plus a
-- server-side function that credits Blox atomically and enforces it - the
-- reward amount and cooldown live here (not in client code) so a modified
-- APK can't just call the RPC in a loop to farm Blox.
alter table public.profiles add column last_ad_reward_at timestamptz;

create or replace function public.claim_ad_reward()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _user uuid := auth.uid();
  _reward constant integer := 10;
  _cooldown constant interval := '20 minutes';
  _last timestamptz;
  _balance integer;
begin
  if _user is null then raise exception 'not_authenticated'; end if;

  select last_ad_reward_at, blox_balance into _last, _balance
    from public.profiles where id = _user for update;

  if _last is not null and _last > now() - _cooldown then
    raise exception 'ad_reward_cooldown';
  end if;

  update public.profiles
    set blox_balance = blox_balance + _reward, last_ad_reward_at = now()
    where id = _user;

  insert into public.blox_transactions (user_id, amount, kind, description)
  values (_user, _reward, 'ad_reward', 'Récompense pour avoir regardé une publicité');

  return _balance + _reward;
end;
$$;
