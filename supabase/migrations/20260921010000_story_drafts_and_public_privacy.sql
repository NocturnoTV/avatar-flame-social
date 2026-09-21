-- Stories: allow a fully public "everyone" audience alongside the existing
-- followers/close_friends options (the RLS side was already open to any
-- non-blocked user for "followers" - the app curates who shows up in whose
-- Stories bar client-side; "everyone" additionally tells that client-side
-- curation to surface the story even to people who don't follow/match the
-- poster), and a draft status so leaving the composer mid-edit doesn't
-- lose the (already-uploaded) media.
alter table public.stories drop constraint stories_visibility_check;
alter table public.stories add constraint stories_visibility_check
  check (visibility in ('everyone', 'followers', 'close_friends'));

alter table public.stories add column if not exists status text not null default 'published'
  check (status in ('draft', 'published'));
create index if not exists stories_status_idx on public.stories(user_id, status);

drop policy if exists "view stories per audience" on public.stories;
create policy "view stories per audience" on public.stories
  for select using (
    user_id = auth.uid()
    or (
      status = 'published'
      and expires_at > now()
      and not is_blocked(auth.uid(), user_id)
      and (visibility <> 'close_friends' or is_close_friend(user_id, auth.uid()))
    )
  );
