ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roblox_user_id TEXT,
  ADD COLUMN IF NOT EXISTS roblox_display_name TEXT,
  ADD COLUMN IF NOT EXISTS roblox_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS roblox_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS roblox_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_roblox_user_id_unique
  ON public.profiles (roblox_user_id)
  WHERE roblox_user_id IS NOT NULL;

ALTER TABLE public.roblox_games
  ADD COLUMN IF NOT EXISTS roblox_universe_id TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS roblox_games_user_universe_unique
  ON public.roblox_games (user_id, roblox_universe_id)
  WHERE roblox_universe_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_roblox_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.roblox_user_id IS DISTINCT FROM OLD.roblox_user_id OR
    NEW.roblox_username IS DISTINCT FROM OLD.roblox_username OR
    NEW.roblox_display_name IS DISTINCT FROM OLD.roblox_display_name OR
    NEW.roblox_avatar_url IS DISTINCT FROM OLD.roblox_avatar_url OR
    NEW.roblox_connected_at IS DISTINCT FROM OLD.roblox_connected_at OR
    NEW.roblox_synced_at IS DISTINCT FROM OLD.roblox_synced_at
  ) THEN
    RAISE EXCEPTION 'roblox_identity_server_only';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_protect_roblox_identity ON public.profiles;
CREATE TRIGGER profiles_protect_roblox_identity
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_roblox_identity();
