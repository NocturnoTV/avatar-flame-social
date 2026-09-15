-- Switching device_login_codes to a 7-digit numeric code (easy to read off
-- one screen and type on another) drops its keyspace to 10^7 - fine against
-- a single guess, but needs real per-requester throttling against a script
-- hammering redeemDeviceLoginCode with random guesses within a code's
-- 5-minute window. This table backs a simple sliding window (see
-- redeemDeviceLoginCode in src/lib/device-login.functions.ts): at most 3
-- attempts per rolling 3-second window per source IP.
create table public.device_code_attempts (
  ip text primary key,
  attempts int not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.device_code_attempts enable row level security;

alter table public.device_login_codes
  alter column expires_at set default (now() + interval '5 minutes');
