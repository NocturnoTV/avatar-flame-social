-- Migrate messages_from from a single string to an array, so more than one
-- audience (matches / followers / everyone) can be allowed at once, and a
-- "followers" option can be added without breaking existing values.
update public.profiles_private
set privacy_prefs = privacy_prefs || jsonb_build_object('messages_from',
  case
    when privacy_prefs->>'messages_from' = 'everyone' then '["everyone"]'::jsonb
    when privacy_prefs->>'messages_from' = 'nobody' then '[]'::jsonb
    else '["matches"]'::jsonb
  end)
where privacy_prefs is not null
  and jsonb_typeof(coalesce(privacy_prefs->'messages_from', '"matches"'::jsonb)) = 'string';

-- messages_from was previously stored but never actually enforced anywhere -
-- start_direct_message only checked blocking. Now it also checks the
-- target's allowed audiences (an existing conversation is never
-- retroactively blocked, and being matched always allows messaging
-- regardless of the setting, same as before).
create or replace function public.start_direct_message(_target uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _me uuid := auth.uid();
  _conv uuid;
  _matched boolean;
  _allowed jsonb;
  _is_follower boolean;
begin
  if _me is null then raise exception 'not_authenticated'; end if;
  if _me = _target then raise exception 'self_message'; end if;
  if public.is_blocked(_me, _target) then raise exception 'blocked'; end if;

  select c.id into _conv
  from public.conversations c
  where c.is_group = false
    and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = _me)
    and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = _target)
  limit 1;

  if _conv is not null then return _conv; end if;

  select exists (
    select 1 from public.matches m
    where (m.user_a = _me and m.user_b = _target) or (m.user_a = _target and m.user_b = _me)
  ) into _matched;

  if not _matched then
    select coalesce(privacy_prefs->'messages_from', '["matches"]'::jsonb)
    into _allowed
    from public.profiles_private where user_id = _target;
    _allowed := coalesce(_allowed, '["matches"]'::jsonb);

    if not (_allowed ? 'everyone') then
      select exists (
        select 1 from public.follows where follower_id = _me and following_id = _target
      ) into _is_follower;
      if not ((_allowed ? 'followers' and _is_follower)) then
        raise exception 'messages_restricted';
      end if;
    end if;
  end if;

  insert into public.conversations (is_group, created_by, request_status)
  values (false, _me, case when _matched then 'accepted' else 'pending' end)
  returning id into _conv;
  insert into public.conversation_participants (conversation_id, user_id) values (_conv, _me), (_conv, _target);
  return _conv;
end; $$;
