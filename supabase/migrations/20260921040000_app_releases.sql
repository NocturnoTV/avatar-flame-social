-- Lets the native app detect "a newer build exists" and prompt to update,
-- without needing to poll the Play/App Store itself (no public API for
-- that). Bump latest_version here whenever a new native build actually goes
-- live - this table is the single source of truth the app checks against,
-- not the store listing.
create table if not exists public.app_releases (
  platform text primary key check (platform in ('android', 'ios')),
  latest_version text not null,
  store_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_releases enable row level security;
grant select on public.app_releases to authenticated, anon;
create policy "app_releases_readable" on public.app_releases for select using (true);

insert into public.app_releases (platform, latest_version, store_url)
values ('android', '1.0.11', 'https://play.google.com/store/apps/details?id=app.bloxspark.mobile')
on conflict (platform) do nothing;
