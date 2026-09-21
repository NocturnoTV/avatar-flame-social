alter table public.calls alter column callee_id drop not null;
alter table public.calls add column if not exists is_group boolean not null default false;

create table if not exists public.call_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'invited' check (status in ('invited','joined','declined','missed','left')),
  joined_at timestamptz,
  left_at timestamptz,
  unique (call_id, user_id)
);

alter table public.call_participants enable row level security;

create policy call_participants_select_participants on public.call_participants
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.calls c where c.id = call_id and c.caller_id = auth.uid())
    or exists (select 1 from public.call_participants cp2 where cp2.call_id = call_participants.call_id and cp2.user_id = auth.uid())
  );

create policy call_participants_insert_caller on public.call_participants
  for insert with check (
    exists (select 1 from public.calls c where c.id = call_id and c.caller_id = auth.uid())
  );

create policy call_participants_update_own on public.call_participants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists calls_select_participants on public.calls;
create policy calls_select_participants on public.calls
  for select using (
    auth.uid() = caller_id
    or auth.uid() = callee_id
    or exists (select 1 from public.call_participants cp where cp.call_id = calls.id and cp.user_id = auth.uid())
  );

drop policy if exists calls_update_participants on public.calls;
create policy calls_update_participants on public.calls
  for update using (
    auth.uid() = caller_id
    or auth.uid() = callee_id
    or exists (select 1 from public.call_participants cp where cp.call_id = calls.id and cp.user_id = auth.uid())
  ) with check (
    auth.uid() = caller_id
    or auth.uid() = callee_id
    or exists (select 1 from public.call_participants cp where cp.call_id = calls.id and cp.user_id = auth.uid())
  );
