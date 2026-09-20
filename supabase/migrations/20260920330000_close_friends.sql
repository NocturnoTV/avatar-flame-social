-- "Amis proches" - a private list only its owner can see, used to gate a
-- Story set to the "close_friends" audience instead of all followers.
create table public.close_friends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
create index close_friends_friend_id_idx on public.close_friends(friend_id);

alter table public.close_friends enable row level security;
create policy "user manages own close friends list" on public.close_friends
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.is_close_friend(_owner uuid, _viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.close_friends where user_id = _owner and friend_id = _viewer
  );
$$;
revoke all on function public.is_close_friend(uuid, uuid) from public, anon;
grant execute on function public.is_close_friend(uuid, uuid) to authenticated;

-- Stories set to "close_friends" are now actually gated to that list
-- instead of the visibility column being purely decorative. Keeps the
-- existing (non-follow-gated - matches can see stories too, per the app's
-- own allowedIds logic) base rule otherwise unchanged.
drop policy if exists "view stories from people you follow or yourself" on public.stories;
drop policy if exists "stories readable" on public.stories;
create policy "view stories per audience" on public.stories
  for select using (
    user_id = auth.uid()
    or (
      expires_at > now()
      and not is_blocked(auth.uid(), user_id)
      and (visibility <> 'close_friends' or is_close_friend(user_id, auth.uid()))
    )
  );
