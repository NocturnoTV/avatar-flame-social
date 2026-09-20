-- User-created stickers: uploaded PNG/JPEG/GIF images usable in
-- conversations and video comments, and shown as a 4th content tab
-- (alongside videos/reposts/photos) on the creator's own profile.
create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  format text not null check (format in ('png', 'jpeg', 'gif')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index stickers_user_id_idx on public.stickers(user_id);

alter table public.stickers enable row level security;

-- Readable by anyone (shown on a profile, and needs to render for whoever
-- receives it in a conversation or sees it on a video comment), but only
-- the creator can add/remove their own.
create policy "anyone can view stickers" on public.stickers
  for select using (true);

create policy "user manages own stickers" on public.stickers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', false, 2097152, array['image/png','image/jpeg','image/gif']);

create policy "stickers_bucket_insert" on storage.objects
  for insert with check (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "stickers_bucket_delete" on storage.objects
  for delete using (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "stickers_bucket_read" on storage.objects
  for select using (bucket_id = 'stickers' and auth.uid() is not null);

alter type message_kind add value 'sticker';
