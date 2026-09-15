-- "Sign in with a code" - lets an already-signed-in device (typically the
-- website in a browser) generate a short-lived code that a second device
-- (typically the native app, freshly installed and logged out) redeems to
-- sign in as the same account instantly, without repeating the full Roblox
-- OAuth flow. Locked down like admin_audit_log: zero RLS policies, only the
-- service-role client (supabaseAdmin, in src/lib/device-login.functions.ts)
-- ever touches this table - a code is a bearer credential for 10 minutes,
-- so it must never be client-readable/listable.
create table public.device_login_codes (
  code text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  attempts int not null default 0
);

alter table public.device_login_codes enable row level security;

create index device_login_codes_user_id_idx on public.device_login_codes (user_id);
