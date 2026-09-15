-- Events & Giveaways: a unified table (kind discriminates the two) so both
-- share the same participation/countdown mechanics, matching how the
-- feature is presented as one page with tabs rather than two separate ones.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event','giveaway')),
  title text not null,
  description text,
  banner_url text,
  prize text,
  organizer_name text,
  location_type text not null default 'online' check (location_type in ('online','in_person')),
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.events enable row level security;

create policy "events_read_all" on public.events for select using (true);

create table if not exists public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_participants enable row level security;

create policy "event_participants_read_all" on public.event_participants for select using (true);
create policy "event_participants_join" on public.event_participants for insert with check (user_id = auth.uid());
create policy "event_participants_leave" on public.event_participants for delete using (user_id = auth.uid());

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at before update on public.events
  for each row execute function public.touch_updated_at();
