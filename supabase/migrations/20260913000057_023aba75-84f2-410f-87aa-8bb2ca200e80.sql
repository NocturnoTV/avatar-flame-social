ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roblox_user_id TEXT,
  ADD COLUMN IF NOT EXISTS roblox_display_name TEXT,
  ADD COLUMN IF NOT EXISTS roblox_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS roblox_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS roblox_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_roblox_user_id_key ON public.profiles (roblox_user_id) WHERE roblox_user_id IS NOT NULL;

ALTER TABLE public.roblox_games
  ADD COLUMN IF NOT EXISTS roblox_universe_id TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;