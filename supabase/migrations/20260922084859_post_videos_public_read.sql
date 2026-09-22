-- Mux Video integration, part 3 (frontend wiring): the original part-1
-- migration deliberately left public read for "later, according to post
-- visibility" - that's now, since actual playback needs every viewer (not
-- just the owner) to read the video's playback id. Only reveals a video
-- once it's processing/ready and attached to a live post - never the
-- owner-only transient uploading/failed/deleted states.

drop policy if exists "post_videos_select_public" on public.post_videos;
create policy "post_videos_select_public" on public.post_videos
  for select to authenticated
  using (
    status in ('processing', 'ready')
    and exists (
      select 1 from public.feed_posts p
      where p.id = post_videos.post_id and p.deleted_at is null
    )
  );
