-- Video-publish drafts: only the wizard's text/settings fields are saved
-- (title, hashtags, visibility, sound, publish options) - the actual video
-- file can't survive a reload, so resuming a draft re-fills these and asks
-- the user to re-pick the same file before continuing.
create table public.video_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  hashtags text[] not null default '{}',
  visibility text not null default 'public',
  sound_id uuid references public.sounds(id) on delete set null,
  sound_title text,
  allow_comments boolean not null default true,
  allow_reactions boolean not null default true,
  allow_sharing boolean not null default true,
  allow_remix boolean not null default true,
  sensitive_content boolean not null default false,
  contains_paid_promotion boolean not null default false,
  contains_ai_content boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index video_drafts_user_id_idx on public.video_drafts(user_id, updated_at desc);

alter table public.video_drafts enable row level security;
create policy "user manages own video drafts" on public.video_drafts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger video_drafts_touch before update on public.video_drafts
  for each row execute function public.touch_updated_at();
