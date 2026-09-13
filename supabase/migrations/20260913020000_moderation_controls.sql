ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'active'
    CHECK (moderation_status IN ('active', 'warned', 'banned')),
  ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_note TEXT;

ALTER TABLE public.profiles ALTER COLUMN language SET DEFAULT 'en';

CREATE INDEX IF NOT EXISTS profiles_moderation_status_idx
  ON public.profiles (moderation_status, created_at DESC);

CREATE POLICY "staff read videos" ON public.videos FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
