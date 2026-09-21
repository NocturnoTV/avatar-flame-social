-- Denormalized like count on comments, so "popular" sort and pagination can
-- be done at the DB level instead of fetching every reaction row client-side.
alter table public.video_comments add column if not exists likes_count integer not null default 0;
update public.video_comments c set likes_count = (
  select count(*) from public.video_comment_reactions r
  where r.comment_id = c.id and r.reaction = 'like'
);
create index if not exists video_comments_video_parent_idx on public.video_comments(video_id, parent_id);
create index if not exists video_comments_likes_idx on public.video_comments(video_id, likes_count desc);

create or replace function public.comment_like_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.reaction = 'like' then
    update public.video_comments set likes_count = likes_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' and old.reaction = 'like' then
    update public.video_comments set likes_count = greatest(0, likes_count - 1) where id = old.comment_id;
  end if;
  return null;
end; $$;

drop trigger if exists comment_like_counter_t on public.video_comment_reactions;
create trigger comment_like_counter_t after insert or delete on public.video_comment_reactions
  for each row execute function public.comment_like_counter();

-- Post owner can pin one comment to the top of their video's thread.
alter table public.videos add column if not exists pinned_comment_id uuid references public.video_comments(id) on delete set null;

-- Real photo attachments in comments (not just pasted GIF links/stickers).
insert into storage.buckets (id, name, public) values ('comment-images', 'comment-images', false)
on conflict (id) do nothing;

create policy "comment_images_bucket_read" on storage.objects for select to authenticated
  using (bucket_id = 'comment-images');
create policy "comment_images_bucket_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'comment-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comment_images_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'comment-images' and (storage.foldername(name))[1] = auth.uid()::text);
