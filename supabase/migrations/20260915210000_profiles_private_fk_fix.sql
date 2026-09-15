-- profiles_private.user_id already had a foreign key to auth.users(id), but
-- none to public.profiles(id). PostgREST's embedded-resource syntax
-- (`.from("profiles").select("...,profiles_private(...)")`, used by
-- adminListMembers) needs a direct FK between the two tables it's joining to
-- infer the relationship - without one it throws "Could not find a
-- relationship between 'profiles' and 'profiles_private' in the schema
-- cache", which silently emptied the admin dashboard's member list ("Aucun
-- membre trouvé").
--
-- Safe to add: every profiles.id is itself an auth.users.id (profiles_id_fkey
-- below), so any row satisfying the existing auth.users FK already satisfies
-- this one too - confirmed zero orphan rows before applying.
alter table public.profiles_private
  add constraint profiles_private_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
