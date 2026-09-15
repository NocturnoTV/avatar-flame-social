-- Group chat management: an owner (defaults to whoever created the group),
-- a group photo, and a hard 25-member cap (bigger groups should become a
-- Community instead, which has no member limit).

alter table public.conversations add column if not exists owner_id uuid references public.profiles(id);
alter table public.conversations add column if not exists avatar_url text;

update public.conversations c set owner_id = c.created_by
where c.owner_id is null and c.created_by is not null
  and exists (select 1 from public.profiles p where p.id = c.created_by);

create or replace function public.create_group(_name text, _members uuid[])
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _me uuid := auth.uid(); _conv uuid; _m uuid; _distinct_members uuid[];
begin
  if _me is null then raise exception 'not_authenticated'; end if;
  select array(select distinct unnest(coalesce(_members, array[]::uuid[])) except select _me) into _distinct_members;
  if array_length(_distinct_members, 1) is not null and array_length(_distinct_members, 1) + 1 > 25 then
    raise exception 'group_full';
  end if;
  insert into public.conversations (is_group, name, created_by, owner_id) values (true, _name, _me, _me) returning id into _conv;
  insert into public.conversation_participants (conversation_id, user_id) values (_conv, _me);
  foreach _m in array coalesce(_distinct_members, array[]::uuid[]) loop
    insert into public.conversation_participants (conversation_id, user_id) values (_conv, _m) on conflict do nothing;
  end loop;
  return _conv;
end; $function$;

-- Group name, photo and ownership transfer are all owner-only. Enforced
-- both in these RPCs and, belt-and-braces, in a trigger below - the
-- existing "members update conversations" RLS policy lets any member
-- update the row (needed for other columns), so without the trigger a
-- non-owner could bypass these RPCs with a raw .update() call.
create or replace function public.rename_group(_conversation uuid, _name text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _owner uuid;
begin
  select owner_id into _owner from public.conversations where id = _conversation and is_group;
  if _owner is null or _owner <> auth.uid() then raise exception 'not_owner'; end if;
  update public.conversations set name = nullif(trim(_name), '') where id = _conversation;
end; $function$;

create or replace function public.set_group_avatar(_conversation uuid, _avatar_url text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _owner uuid;
begin
  select owner_id into _owner from public.conversations where id = _conversation and is_group;
  if _owner is null or _owner <> auth.uid() then raise exception 'not_owner'; end if;
  update public.conversations set avatar_url = _avatar_url where id = _conversation;
end; $function$;

create or replace function public.set_group_owner(_conversation uuid, _new_owner uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _owner uuid; _is_member boolean;
begin
  select owner_id into _owner from public.conversations where id = _conversation and is_group;
  if _owner is null or _owner <> auth.uid() then raise exception 'not_owner'; end if;
  select exists(
    select 1 from public.conversation_participants where conversation_id = _conversation and user_id = _new_owner
  ) into _is_member;
  if not _is_member then raise exception 'not_a_member'; end if;
  update public.conversations set owner_id = _new_owner where id = _conversation;
end; $function$;

create or replace function public.guard_conversation_privileged_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if (new.name is distinct from old.name or new.avatar_url is distinct from old.avatar_url or new.owner_id is distinct from old.owner_id)
     and old.is_group
     and (old.owner_id is null or old.owner_id <> auth.uid()) then
    raise exception 'not_owner';
  end if;
  return new;
end; $function$;

drop trigger if exists trg_guard_conversation_privileged_fields on public.conversations;
create trigger trg_guard_conversation_privileged_fields
  before update on public.conversations
  for each row execute function public.guard_conversation_privileged_fields();
