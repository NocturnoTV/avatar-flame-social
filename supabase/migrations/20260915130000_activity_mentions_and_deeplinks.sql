-- Lets "Activités" notifications deep-link to the exact video/comment they
-- refer to, and adds a "video_mention" kind for @username mentions inside
-- video comments.

alter table public.notifications add column if not exists video_id uuid references public.videos(id) on delete cascade;
alter table public.notifications add column if not exists comment_id uuid references public.video_comments(id) on delete cascade;
alter type notification_kind add value if not exists 'video_mention';

create or replace function public.notify_video_like()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _owner uuid;
begin
  select user_id into _owner from public.videos where id = new.video_id;
  if _owner is null or _owner = new.user_id then return new; end if;
  insert into public.notifications (user_id, kind, actor_id, body, video_id)
  values (_owner, 'video_like', new.user_id, null, new.video_id);
  return new;
end; $function$;

create or replace function public.notify_video_favorite()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _owner uuid;
begin
  select user_id into _owner from public.videos where id = new.video_id;
  if _owner is null or _owner = new.user_id then return new; end if;
  insert into public.notifications (user_id, kind, actor_id, body, video_id)
  values (_owner, 'video_favorite', new.user_id, null, new.video_id);
  return new;
end; $function$;

create or replace function public.notify_video_repost()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _owner uuid;
begin
  select user_id into _owner from public.videos where id = new.video_id;
  if _owner is null or _owner = new.user_id then return new; end if;
  insert into public.notifications (user_id, kind, actor_id, body, video_id)
  values (_owner, 'video_repost', new.user_id, null, new.video_id);
  return new;
end; $function$;

create or replace function public.notify_video_comment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _owner uuid; _parent_author uuid;
begin
  select user_id into _owner from public.videos where id = new.video_id;

  if _owner is not null and _owner <> new.user_id then
    insert into public.notifications (user_id, kind, actor_id, body, video_id, comment_id)
    values (_owner, 'video_comment', new.user_id, left(coalesce(new.content, ''), 100), new.video_id, new.id);
  end if;

  if new.parent_id is not null then
    select user_id into _parent_author from public.video_comments where id = new.parent_id;
    if _parent_author is not null and _parent_author <> new.user_id and _parent_author is distinct from _owner then
      insert into public.notifications (user_id, kind, actor_id, body, video_id, comment_id)
      values (_parent_author, 'video_comment_reply', new.user_id, left(coalesce(new.content, ''), 100), new.video_id, new.id);
    end if;
  end if;
  return new;
end; $function$;

-- @username mentions inside a video comment notify each mentioned user,
-- in addition to the owner/reply notifications above.
create or replace function public.notify_video_comment_mentions()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _handle text; _mentioned uuid;
begin
  if new.content is null then return new; end if;
  for _handle in
    select distinct lower(m[1]) from regexp_matches(new.content, '@([A-Za-z0-9_]{2,32})', 'g') as m
  loop
    select id into _mentioned from public.profiles where lower(username) = _handle;
    if _mentioned is not null and _mentioned <> new.user_id then
      insert into public.notifications (user_id, kind, actor_id, body, video_id, comment_id)
      values (_mentioned, 'video_mention', new.user_id, left(new.content, 100), new.video_id, new.id);
    end if;
  end loop;
  return new;
end; $function$;

drop trigger if exists trg_notify_video_comment_mentions on public.video_comments;
create trigger trg_notify_video_comment_mentions
  after insert on public.video_comments
  for each row execute function public.notify_video_comment_mentions();
