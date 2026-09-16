-- One row per registered device push token, so the server can fan out real
-- OS-level push notifications (Firebase Cloud Messaging) alongside the
-- existing in-app "notifications" rows. A user can have several devices;
-- the token itself is unique (re-registering the same device just updates
-- who currently owns it, e.g. after a fresh install or account switch).
create table public.push_device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_device_tokens_user_id_idx on public.push_device_tokens(user_id);

alter table public.push_device_tokens enable row level security;

-- Someone can register/remove their own device's token; reads/sends are
-- server-side only (supabaseAdmin), same pattern as device_login_codes.
create policy "insert own device token" on public.push_device_tokens
  for insert with check (user_id = auth.uid());

create policy "update own device token" on public.push_device_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own device token" on public.push_device_tokens
  for delete using (user_id = auth.uid());
