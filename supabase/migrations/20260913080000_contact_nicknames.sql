-- Private per-viewer nickname for a contact (visible only to the person who set it).
CREATE TABLE IF NOT EXISTS public.contact_nicknames (
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_nicknames TO authenticated;
GRANT ALL ON public.contact_nicknames TO service_role;
ALTER TABLE public.contact_nicknames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own contact nicknames" ON public.contact_nicknames;
CREATE POLICY "own contact nicknames" ON public.contact_nicknames FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
