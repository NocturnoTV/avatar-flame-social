-- Text/sticker overlays are composited on top of the media at view time
-- (position + content only) rather than burned into the image/video pixels -
-- much simpler to build reliably, and just as visible to viewers.
alter table public.stories add column if not exists metadata jsonb not null default '{}'::jsonb;
