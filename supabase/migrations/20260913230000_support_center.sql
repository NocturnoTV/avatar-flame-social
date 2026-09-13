-- Extend bug_reports into general support tickets (keeps the existing
-- table/RLS/admin wiring, just adds a category so it covers more than bugs).
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'bug'
    CHECK (category IN ('account','roblox','payment','sparks','report','bug','copyright','other'));

-- Per-service rows on top of the existing single 'default' aggregate row.
INSERT INTO public.service_status (id, status)
VALUES
  ('website', 'operational'),
  ('api', 'operational'),
  ('roblox_auth', 'operational'),
  ('payments', 'operational'),
  ('sparks', 'operational'),
  ('storage', 'operational')
ON CONFLICT (id) DO NOTHING;

-- Incident history shown on the status page.
CREATE TABLE IF NOT EXISTS public.service_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'resolved' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_incidents TO authenticated, anon;
GRANT ALL ON public.service_incidents TO service_role;
ALTER TABLE public.service_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incidents readable" ON public.service_incidents;
CREATE POLICY "incidents readable" ON public.service_incidents FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "staff manage incidents" ON public.service_incidents;
CREATE POLICY "staff manage incidents" ON public.service_incidents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
