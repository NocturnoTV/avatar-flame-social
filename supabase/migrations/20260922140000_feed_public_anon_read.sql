-- Guests (anon role, no session) now get real read-only access to the app,
-- but feed_posts and post_videos only had SELECT policies scoped to
-- "authenticated" - so every guest query against them silently returned
-- zero rows (RLS denies by default, it doesn't error), making Feed and
-- Home's trending-posts row look empty instead of showing an error anyone
-- would have noticed sooner.

create policy feed_posts_read_public_anon on public.feed_posts
  for select
  to anon
  using (deleted_at is null);

create policy post_videos_select_public_anon on public.post_videos
  for select
  to anon
  using (
    status in ('processing', 'ready')
    and exists (select 1 from feed_posts p where p.id = post_videos.post_id and p.deleted_at is null)
  );

-- Same gap on video comments (Discover's comments sheet has no `enabled:
-- !!user` guard - it's meant to be visible to everyone). is_blocked(auth.uid(), ...)
-- with a null auth.uid() already always evaluates to false, so this is
-- just the equivalent of the real "comments_select" policy for anon.
create policy comments_select_anon on public.video_comments
  for select
  to anon
  using (true);
