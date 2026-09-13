-- Online-status privacy: let a user appear offline, or show a
-- do-not-disturb indicator, independent of their real last_active_at.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dnd BOOLEAN NOT NULL DEFAULT false;
