CREATE OR REPLACE FUNCTION public.protect_spark_plus_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE request_role TEXT;
BEGIN
  request_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((current_setting('request.jwt.claims', true)::json ->> 'role'), ''),
    current_user
  );
  IF request_role NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF NEW.spark_plus_active IS DISTINCT FROM OLD.spark_plus_active
      OR NEW.spark_plus_expires_at IS DISTINCT FROM OLD.spark_plus_expires_at THEN
      RAISE EXCEPTION 'Spark Plus membership is managed by billing';
    END IF;
    IF (NOT OLD.spark_plus_active OR (OLD.spark_plus_expires_at IS NOT NULL AND OLD.spark_plus_expires_at <= now()))
      AND (
        NEW.profile_font IS DISTINCT FROM OLD.profile_font
        OR NEW.profile_glow IS DISTINCT FROM OLD.profile_glow
        OR NEW.banner_video_url IS DISTINCT FROM OLD.banner_video_url
      ) THEN
      RAISE EXCEPTION 'Spark Plus is required for this customization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;