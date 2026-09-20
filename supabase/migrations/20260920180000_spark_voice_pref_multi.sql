-- "How do you prefer to play?" is now a multi-select (up to 3), not a
-- single choice - convert spark_voice_pref from text to text[].
alter table public.profiles drop constraint spark_voice_pref_valid;
alter table public.profiles alter column spark_voice_pref type text[] using case when spark_voice_pref is null then '{}'::text[] else array[spark_voice_pref] end;
alter table public.profiles alter column spark_voice_pref set default '{}';
alter table public.profiles alter column spark_voice_pref set not null;
alter table public.profiles add constraint spark_voice_pref_valid check (
  spark_voice_pref <@ array['roblox_voice','chat_only','discord_voice','no_voice']::text[]
  and (array_length(spark_voice_pref, 1) is null or array_length(spark_voice_pref, 1) <= 3)
);
