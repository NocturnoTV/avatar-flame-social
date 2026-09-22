-- Mux Video integration, part 4: migrates Discover's existing video system
-- (the `videos` table) to Mux too - reuses the table itself rather than
-- routing Discover through post_videos (which is FK'd to feed_posts
-- specifically). A null mux_status means "still Supabase-Storage-backed" -
-- storage_path stays the source of truth for those rows. A non-null
-- mux_status means Mux is the source of truth once it's 'ready'.

alter table public.videos
  add column if not exists mux_asset_id text unique,
  add column if not exists mux_playback_id text,
  add column if not exists mux_upload_id text unique,
  add column if not exists mux_status text check (mux_status in ('uploading','processing','ready','failed')),
  add column if not exists mux_error_message text;

-- A brand-new Mux-backed video has no Supabase Storage file at all, so
-- storage_path can no longer be mandatory - the check constraint below
-- ensures every row still has at least one real playback source.
alter table public.videos alter column storage_path drop not null;

alter table public.videos drop constraint if exists videos_has_playback_source;
alter table public.videos add constraint videos_has_playback_source
  check (storage_path is not null or mux_upload_id is not null);

create index if not exists videos_mux_status_idx on public.videos (mux_status) where mux_status is not null;
