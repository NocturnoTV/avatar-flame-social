-- Let unauthenticated (anon) visitors browse real public videos and public
-- profiles in Guest mode. Everything else (likes, comments, messages,
-- follows, Sparks...) still requires an authenticated account since those
-- tables' INSERT/UPDATE policies are unchanged.
DROP POLICY IF EXISTS "anon read public videos" ON public.videos;
CREATE POLICY "anon read public videos" ON public.videos FOR SELECT TO anon
  USING (visibility = 'public');

DROP POLICY IF EXISTS "anon read public profiles" ON public.profiles;
CREATE POLICY "anon read public profiles" ON public.profiles FOR SELECT TO anon
  USING (onboarding_completed = true);

DROP POLICY IF EXISTS "anon read videos bucket" ON storage.objects;
CREATE POLICY "anon read videos bucket" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "anon read profile photos bucket" ON storage.objects;
CREATE POLICY "anon read profile photos bucket" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'profile-photos');
