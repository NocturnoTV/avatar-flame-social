CREATE OR REPLACE FUNCTION public.guest_profiles(_limit integer DEFAULT 40)
RETURNS TABLE (
  id uuid,
  username text,
  bio text,
  avatar_url text,
  roblox_display_name text,
  roblox_username text,
  roblox_avatar_url text,
  language text,
  verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.bio,
    p.avatar_url,
    p.roblox_display_name,
    p.roblox_username,
    p.roblox_avatar_url,
    p.language,
    p.verified
  FROM public.profiles AS p
  WHERE p.onboarding_completed = true
    AND p.deletion_requested_at IS NULL
  ORDER BY p.last_active_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 40), 1), 60);
$$;

REVOKE ALL ON FUNCTION public.guest_profiles(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_profiles(integer) TO anon, authenticated;
