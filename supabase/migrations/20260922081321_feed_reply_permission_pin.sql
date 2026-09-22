-- Enforces the reply-permission setting server-side (it was only checked in
-- the UI before, so anyone could reply directly through the API regardless
-- of "following"/"mentioned"/"none"), and adds a pinned post per profile.

create or replace function public.can_reply_to_post(_post_id uuid, _replier uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  _perm text;
  _author uuid;
  _content text;
  _replier_username text;
begin
  select reply_permission, user_id, content into _perm, _author, _content from public.feed_posts where id = _post_id;
  if _perm is null or _author is null then return true; end if;
  if _author = _replier then return true; end if;
  if _perm = 'everyone' then return true; end if;
  if _perm = 'none' then return false; end if;
  if _perm = 'following' then
    return exists (select 1 from public.follows where follower_id = _author and following_id = _replier);
  end if;
  if _perm = 'mentioned' then
    select username into _replier_username from public.profiles where id = _replier;
    return _replier_username is not null and _content ilike ('%@' || _replier_username || '%');
  end if;
  return true;
end; $$;

drop policy if exists "feed_posts_insert_own" on public.feed_posts;
create policy "feed_posts_insert_own" on public.feed_posts for insert to authenticated
  with check (
    user_id = auth.uid()
    and (reply_to_id is null or public.can_reply_to_post(reply_to_id, auth.uid()))
  );

alter table public.profiles add column if not exists pinned_feed_post_id uuid references public.feed_posts(id) on delete set null;
