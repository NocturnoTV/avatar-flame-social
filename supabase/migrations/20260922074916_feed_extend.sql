-- Extends the pre-existing (unused) feed_posts schema into a real X-style
-- feed: replies are just feed_posts rows with reply_to_id set (so they can
-- themselves be liked/reposted/replied-to), quote_post_id supports
-- commented reposts, reply_permission gates who can reply, and posts are
-- soft-deleted (deleted_at) so quotes/replies can show "no longer available"
-- instead of losing the reference entirely.

alter table public.feed_posts
  add column if not exists reply_to_id uuid references public.feed_posts(id) on delete set null,
  add column if not exists quote_post_id uuid references public.feed_posts(id) on delete set null,
  add column if not exists reply_permission text not null default 'everyone' check (reply_permission in ('everyone','following','mentioned','none')),
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists media jsonb not null default '[]'::jsonb;

create index if not exists feed_posts_reply_to_idx on public.feed_posts (reply_to_id);
create index if not exists feed_posts_quote_idx on public.feed_posts (quote_post_id);

drop policy if exists "feed_posts_read_all" on public.feed_posts;
create policy "feed_posts_read_all" on public.feed_posts for select to authenticated
  using ((deleted_at is null or user_id = auth.uid()) and (user_id = auth.uid() or not is_blocked(auth.uid(), user_id)));

drop policy if exists "feed_posts_update_own" on public.feed_posts;
create policy "feed_posts_update_own" on public.feed_posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.feed_posts_reply_count_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' and NEW.reply_to_id is not null then
    update public.feed_posts set replies_count = replies_count + 1 where id = NEW.reply_to_id;
  elsif TG_OP = 'UPDATE' and NEW.deleted_at is not null and OLD.deleted_at is null and NEW.reply_to_id is not null then
    update public.feed_posts set replies_count = greatest(replies_count - 1, 0) where id = NEW.reply_to_id;
  end if;
  return NEW;
end; $$;
drop trigger if exists feed_posts_reply_count on public.feed_posts;
create trigger feed_posts_reply_count after insert or update on public.feed_posts
for each row execute function public.feed_posts_reply_count_touch();

create table if not exists public.feed_post_bookmarks (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.feed_post_bookmarks enable row level security;
drop policy if exists "feed_post_bookmarks_own" on public.feed_post_bookmarks;
create policy "feed_post_bookmarks_own" on public.feed_post_bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.feed_post_bookmarks to authenticated;
grant all on public.feed_post_bookmarks to service_role;

-- Reuses the existing generic moderation pipeline (reports table) for posts
-- instead of building a parallel one.
alter table public.reports add column if not exists post_id uuid references public.feed_posts(id) on delete cascade;
