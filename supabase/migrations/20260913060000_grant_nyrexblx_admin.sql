-- Grant admin access to NyrexBLX (matches either the BloxSpark username or
-- the linked Roblox username, case-insensitive) so they can use /admin.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM public.profiles
WHERE lower(username) = lower('NyrexBLX') OR lower(roblox_username) = lower('NyrexBLX')
ON CONFLICT DO NOTHING;
