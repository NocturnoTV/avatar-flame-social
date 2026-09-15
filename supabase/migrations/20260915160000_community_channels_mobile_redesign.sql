-- Backend support for the mobile Discord-style Communities redesign:
-- voice channels (as a channel kind - no real-time audio infra, just the
-- distinction and UI for it), reactions, replies, GIF/voice messages.

alter table public.community_channels add column if not exists kind text not null default 'text';
alter table public.community_channels add constraint community_channels_kind_check check (kind = any (array['text','voice'])) not valid;
alter table public.community_channels validate constraint community_channels_kind_check;

alter table public.community_channel_messages add column if not exists kind text not null default 'text';
alter table public.community_channel_messages add constraint community_channel_messages_kind_check check (kind = any (array['text','image','voice','gif'])) not valid;
alter table public.community_channel_messages validate constraint community_channel_messages_kind_check;
alter table public.community_channel_messages add column if not exists media_url text;
alter table public.community_channel_messages add column if not exists duration_ms integer;
alter table public.community_channel_messages add column if not exists reply_to_id uuid references public.community_channel_messages(id) on delete set null;

create table if not exists public.community_channel_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.community_channel_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
alter table public.community_channel_message_reactions enable row level security;

create policy "community_channel_message_reactions_read_members" on public.community_channel_message_reactions
  for select using (
    exists (
      select 1 from public.community_channel_messages msg
      join public.community_members m on m.community_id = msg.community_id and m.user_id = auth.uid()
      where msg.id = community_channel_message_reactions.message_id
    )
  );

create policy "community_channel_message_reactions_write_members" on public.community_channel_message_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_channel_messages msg
      join public.community_members m on m.community_id = msg.community_id and m.user_id = auth.uid()
      where msg.id = community_channel_message_reactions.message_id
    )
  );

create policy "community_channel_message_reactions_delete_own" on public.community_channel_message_reactions
  for delete using (user_id = auth.uid());

create or replace function public.community_create_channel(_community uuid, _category uuid, _name text, _kind text default 'text')
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _id uuid; _pos int;
begin
  if not public.community_has_permission(_community, auth.uid(), 'manage_channels') then
    raise exception 'not_authorized';
  end if;
  if _kind not in ('text', 'voice') then
    raise exception 'invalid_kind';
  end if;
  select coalesce(max(position), -1) + 1 into _pos from public.community_channels where community_id = _community;
  insert into public.community_channels (community_id, category_id, name, position, kind)
  values (_community, _category, _name, _pos, _kind) returning id into _id;
  perform public.log_community_action(_community, auth.uid(), 'create_channel', null, _name);
  return _id;
end; $function$;
