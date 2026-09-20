-- Transparency disclosures on the publish-options step: paid promotion and
-- AI-generated content, shown on the video itself once rendered.
alter table public.videos
  add column if not exists contains_paid_promotion boolean not null default false,
  add column if not exists contains_ai_content boolean not null default false;
