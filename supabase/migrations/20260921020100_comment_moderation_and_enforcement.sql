-- Let the existing generic reports table cover comment reports too, instead
-- of creating a parallel comment-report table the admin moderation queue
-- wouldn't know about.
alter table public.reports add column if not exists comment_id uuid references public.video_comments(id) on delete cascade;

-- Comment visibility/posting must respect blocks and the creator's "allow
-- comments" toggle (already set from the publish wizard, but never enforced
-- anywhere until now) server-side, not just via client-side filtering.
drop policy if exists "comments_select" on public.video_comments;
create policy "comments_select" on public.video_comments for select to authenticated
  using (not public.is_blocked(auth.uid(), user_id));

drop policy if exists "comments_write" on public.video_comments;
create policy "comments_write" on public.video_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.videos v
      where v.id = video_id
        and v.allow_comments
        and not public.is_blocked(auth.uid(), v.user_id)
    )
  );

-- Notify a commenter when their comment gets liked (mirrors notify_video_like).
create or replace function public.notify_comment_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare _commenter uuid; _video_id uuid;
begin
  if new.reaction <> 'like' then return new; end if;
  select user_id, video_id into _commenter, _video_id from public.video_comments where id = new.comment_id;
  if _commenter is null or _commenter = new.user_id then return new; end if;
  insert into public.notifications (user_id, kind, actor_id, video_id, comment_id)
  values (_commenter, 'video_comment_like', new.user_id, _video_id, new.comment_id);
  return new;
end; $$;

drop trigger if exists video_comment_likes_notify on public.video_comment_reactions;
create trigger video_comment_likes_notify after insert on public.video_comment_reactions
  for each row execute function public.notify_comment_like();

-- The comment author could already delete their own comment; the video
-- owner could not remove comments left on their own post, which the
-- moderation menu (delete as post owner) needs.
drop policy if exists "comments_delete" on public.video_comments;
create policy "comments_delete" on public.video_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.videos v where v.id = video_id and v.user_id = auth.uid())
  );
