alter table public.video_reposts add column if not exists note text;
alter table public.video_reposts add constraint video_reposts_note_length check (note is null or char_length(note) <= 200);
