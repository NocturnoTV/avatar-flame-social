-- Community sound library: anyone can publish a sound (public, or private -
-- visible only on their own profile), pick one when posting a video or
-- Story, and see how many posts use it.
create table public.sounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  title text not null,
  description text,
  duration_seconds numeric,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  rights_confirmed boolean not null default false,
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index sounds_user_id_idx on public.sounds(user_id);
create index sounds_visibility_idx on public.sounds(visibility, created_at desc);

alter table public.sounds enable row level security;
create policy "anyone can view public sounds" on public.sounds
  for select using (visibility = 'public' or user_id = auth.uid());
create policy "user manages own sounds" on public.sounds
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and rights_confirmed);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sounds', 'sounds', false, 15728640, array['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/webm','audio/ogg']);

create policy "sounds_bucket_insert" on storage.objects
  for insert with check (bucket_id = 'sounds' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sounds_bucket_delete" on storage.objects
  for delete using (bucket_id = 'sounds' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sounds_bucket_read" on storage.objects
  for select using (bucket_id = 'sounds' and auth.uid() is not null);

-- Link videos to a real library sound (sound_name stays as a plain-text
-- fallback/display label for legacy rows and freeform captions).
alter table public.videos add column if not exists sound_id uuid references public.sounds(id) on delete set null;

create or replace function public.bump_sound_usage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.sound_id is not null and (TG_OP = 'INSERT' or NEW.sound_id is distinct from OLD.sound_id) then
    update public.sounds set usage_count = usage_count + 1 where id = NEW.sound_id;
  end if;
  if TG_OP = 'UPDATE' and OLD.sound_id is not null and OLD.sound_id is distinct from NEW.sound_id then
    update public.sounds set usage_count = greatest(0, usage_count - 1) where id = OLD.sound_id;
  end if;
  return NEW;
end;
$$;
drop trigger if exists videos_bump_sound_usage on public.videos;
create trigger videos_bump_sound_usage
after insert or update of sound_id on public.videos
for each row execute function public.bump_sound_usage();

-- =========================================================
-- Stories: the basic ephemeral-post table/bucket/story_views already
-- existed (from earlier work) - extend it to match the fuller feature
-- (thumbnails, an attached sound, a real audience choice, and archiving
-- instead of hard-deleting when a story expires).
-- =========================================================
alter table public.stories
  add column if not exists thumbnail_path text,
  add column if not exists sound_id uuid references public.sounds(id) on delete set null,
  add column if not exists visibility text not null default 'followers' check (visibility in ('followers', 'close_friends')),
  add column if not exists archived boolean not null default false;

create index if not exists stories_expires_at_idx on public.stories(expires_at);

create table public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (story_id, user_id)
);
alter table public.story_reactions enable row level security;
create policy "story owner and reactor read reactions" on public.story_reactions
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid())
  );
create policy "user manages own reaction" on public.story_reactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.story_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  cover_path text,
  created_at timestamptz not null default now()
);
create table public.story_highlight_items (
  highlight_id uuid not null references public.story_highlights(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  position integer not null default 0,
  primary key (highlight_id, story_id)
);
alter table public.story_highlights enable row level security;
alter table public.story_highlight_items enable row level security;
create policy "anyone can view highlights" on public.story_highlights for select using (true);
create policy "user manages own highlights" on public.story_highlights
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "anyone can view highlight items" on public.story_highlight_items for select using (true);
create policy "user manages own highlight items" on public.story_highlight_items
  for all using (
    exists (select 1 from public.story_highlights h where h.id = highlight_id and h.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.story_highlights h where h.id = highlight_id and h.user_id = auth.uid())
  );

-- A reply sent from the story viewer lands as a normal DM referencing the
-- story, so it shows up in the recipient's inbox like any other message
-- instead of needing a whole separate notification surface.
alter table public.messages add column if not exists story_id uuid references public.stories(id) on delete set null;
