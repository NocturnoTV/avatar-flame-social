-- A dedicated, member-readable sanction history (separate from the
-- staff-only admin_audit_log, which mixes in unrelated actions and details
-- not meant for a member to see) plus a dispute/contestation flow on top
-- of it, reviewable by staff in Moderation.

create table if not exists public.moderation_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('warn','ban','unban')),
  reason text,
  moderator_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.moderation_sanctions enable row level security;

create policy "moderation_sanctions_own_read" on public.moderation_sanctions
  for select using (user_id = auth.uid());
create policy "moderation_sanctions_staff_read" on public.moderation_sanctions
  for select using (is_staff(auth.uid()));

create table if not exists public.moderation_disputes (
  id uuid primary key default gen_random_uuid(),
  sanction_id uuid references public.moderation_sanctions(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  moderator_id uuid references public.profiles(id),
  moderator_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.moderation_disputes enable row level security;

create policy "moderation_disputes_own_read" on public.moderation_disputes
  for select using (user_id = auth.uid());
create policy "moderation_disputes_own_insert" on public.moderation_disputes
  for insert with check (user_id = auth.uid());
create policy "moderation_disputes_staff_read" on public.moderation_disputes
  for select using (is_staff(auth.uid()));
