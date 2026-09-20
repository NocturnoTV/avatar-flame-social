-- A persistent, revocable sign-in link (unlike the 7-digit device codes,
-- which are single-use and expire in 5 minutes) - generated once from
-- Settings, reusable indefinitely until regenerated. Only the hash is
-- stored, same as a password.
create table public.device_login_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.device_login_links enable row level security;
-- service-role only, same as device_login_codes/device_code_attempts - no
-- policies, nothing for a regular client role to select/insert/update here.
