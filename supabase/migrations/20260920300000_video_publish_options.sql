-- Publish-options screen in the video wizard: per-video toggles for
-- comments/reactions/sharing/remixes, plus a self-flagged sensitive-content
-- marker (used to soften the tile/blur it behind a tap-through warning).
alter table public.videos
  add column if not exists allow_comments boolean not null default true,
  add column if not exists allow_reactions boolean not null default true,
  add column if not exists allow_sharing boolean not null default true,
  add column if not exists allow_remix boolean not null default true,
  add column if not exists sensitive_content boolean not null default false;
