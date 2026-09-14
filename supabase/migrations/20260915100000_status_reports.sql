CREATE TABLE IF NOT EXISTS public.status_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('website','login','game_join','studio','avatar','marketplace','other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS status_reports_created_idx ON public.status_reports(created_at DESC);
ALTER TABLE public.status_reports ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.status_reports TO authenticated;
GRANT SELECT ON public.status_reports TO service_role;

DROP POLICY IF EXISTS "members create status reports" ON public.status_reports;
CREATE POLICY "members create status reports" ON public.status_reports
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_status_report_spam()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.status_reports
    WHERE user_id = NEW.user_id AND created_at > now() - INTERVAL '5 minutes'
  ) THEN
    RAISE EXCEPTION 'report_rate_limited';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_status_report_spam() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS status_report_rate_limit ON public.status_reports;
CREATE TRIGGER status_report_rate_limit BEFORE INSERT ON public.status_reports
FOR EACH ROW EXECUTE FUNCTION public.prevent_status_report_spam();

CREATE OR REPLACE FUNCTION public.status_report_series()
RETURNS TABLE(bucket TIMESTAMPTZ, report_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    date_trunc('hour', created_at) AS bucket,
    count(*)::BIGINT AS report_count
  FROM public.status_reports
  WHERE created_at >= now() - INTERVAL '24 hours'
  GROUP BY 1
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.status_report_series() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.status_report_series() TO authenticated, anon;
