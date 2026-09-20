-- New profile-edit fields for finding the right playmates on Sparks:
-- age visibility toggle, spoken languages (max 3), what someone is looking
-- for, preferred communication style, and availability windows.
alter table public.profiles
  add column age_visible boolean not null default true,
  add column spoken_languages text[] not null default '{}',
  add column spark_looking_for text,
  add column spark_voice_pref text,
  add column spark_availability text[] not null default '{}';

alter table public.profiles
  add constraint spoken_languages_max_three check (array_length(spoken_languages, 1) is null or array_length(spoken_languages, 1) <= 3),
  add constraint spark_looking_for_valid check (spark_looking_for is null or spark_looking_for in ('duo', 'friends', 'creation_partner')),
  add constraint spark_voice_pref_valid check (spark_voice_pref is null or spark_voice_pref in ('roblox_voice', 'chat_only', 'discord_voice', 'no_voice')),
  add constraint spark_availability_valid check (
    spark_availability <@ array['morning', 'afternoon', 'late_afternoon', 'evening', 'night', 'weekend']::text[]
  );
