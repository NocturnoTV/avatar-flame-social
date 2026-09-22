-- Mux Video integration, part 1: tracks a video attachment through Mux's
-- direct-upload -> asset pipeline for a feed post. post_id is nullable
-- because the upload starts (and gets its Mux upload URL) before the post
-- itself is published - the client attaches post_id once the post is
-- created. Reuses the existing feed_posts table (no duplicate "posts"
-- table) and the existing touch_updated_at() trigger function.

create table if not exists public.post_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.feed_posts(id) on delete cascade,
  mux_upload_id text unique,
  mux_asset_id text unique,
  mux_playback_id text,
  status text not null default 'uploading' check (status in ('uploading','processing','ready','failed','deleted')),
  duration_seconds numeric,
  aspect_ratio text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_videos_user_id_idx on public.post_videos (user_id);
create index if not exists post_videos_post_id_idx on public.post_videos (post_id);

drop trigger if exists post_videos_touch_updated_at on public.post_videos;
create trigger post_videos_touch_updated_at before update on public.post_videos
for each row execute function public.touch_updated_at();

alter table public.post_videos enable row level security;

-- Not part of the literal spec (which only asked for insert/update/delete
-- rules and deferred public read) but included so an owner can at least see
-- their own upload's status - RLS denies all reads by default otherwise.
drop policy if exists "post_videos_select_own" on public.post_videos;
create policy "post_videos_select_own" on public.post_videos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "post_videos_insert_own" on public.post_videos;
create policy "post_videos_insert_own" on public.post_videos
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "post_videos_update_own" on public.post_videos;
create policy "post_videos_update_own" on public.post_videos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "post_videos_delete_own" on public.post_videos;
create policy "post_videos_delete_own" on public.post_videos
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.post_videos to authenticated;
grant all on public.post_videos to service_role;
