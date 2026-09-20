-- Settings gets a real "Parental controls" section - restricted content
-- mode, purchase approval, and a daily time limit, stored per-account next
-- to the existing parent_name/parent_email/parental_consent fields already
-- collected for minors during onboarding.
alter table public.profiles_private
  add column if not exists parental_restricted_mode boolean not null default false,
  add column if not exists parental_purchase_approval boolean not null default false,
  add column if not exists parental_daily_limit_minutes integer;
