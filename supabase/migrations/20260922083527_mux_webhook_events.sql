-- Mux Video integration, part 2: idempotency ledger for incoming webhooks.
-- Backend-only by design - RLS is enabled with zero policies for
-- authenticated/anon, which denies all access to those roles outright; only
-- the service-role client the mux-webhook function uses can touch this
-- table.

create table if not exists public.mux_webhook_events (
  id uuid primary key default gen_random_uuid(),
  mux_event_id text unique not null,
  event_type text not null,
  object_id text,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create index if not exists mux_webhook_events_event_type_idx on public.mux_webhook_events (event_type);

alter table public.mux_webhook_events enable row level security;
revoke all on public.mux_webhook_events from authenticated, anon;
grant all on public.mux_webhook_events to service_role;
