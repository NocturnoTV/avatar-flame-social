ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spark_plus_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spark_plus_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_font TEXT NOT NULL DEFAULT 'default'
    CHECK (profile_font IN ('default', 'rounded', 'serif', 'mono', 'display')),
  ADD COLUMN IF NOT EXISTS profile_glow TEXT NOT NULL DEFAULT 'none'
    CHECK (profile_glow IN ('none', 'blue', 'cyan', 'royal'));

CREATE TABLE IF NOT EXISTS public.spark_plus_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id TEXT UNIQUE,
  provider_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'cancelled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.spark_plus_subscriptions TO authenticated;
GRANT ALL ON public.spark_plus_subscriptions TO service_role;
ALTER TABLE public.spark_plus_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own spark plus subscription" ON public.spark_plus_subscriptions;
CREATE POLICY "read own spark plus subscription" ON public.spark_plus_subscriptions
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS spark_plus_subscription_touch ON public.spark_plus_subscriptions;
CREATE TRIGGER spark_plus_subscription_touch BEFORE UPDATE ON public.spark_plus_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS profiles_spark_plus_content_boost
  ON public.profiles (spark_plus_active, spark_plus_expires_at);

COMMENT ON COLUMN public.profiles.spark_plus_active IS
  'Managed by the billing webhook. Never writable from the client.';

CREATE OR REPLACE FUNCTION public.protect_spark_plus_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE request_role TEXT;
BEGIN
  request_role := current_setting('request.jwt.claim.role', true);
  IF request_role IS DISTINCT FROM 'service_role' THEN
    IF NEW.spark_plus_active IS DISTINCT FROM OLD.spark_plus_active
      OR NEW.spark_plus_expires_at IS DISTINCT FROM OLD.spark_plus_expires_at THEN
      RAISE EXCEPTION 'Spark Plus membership is managed by billing';
    END IF;
    IF (NOT OLD.spark_plus_active OR (OLD.spark_plus_expires_at IS NOT NULL AND OLD.spark_plus_expires_at <= now()))
      AND (NEW.profile_font IS DISTINCT FROM OLD.profile_font OR NEW.profile_glow IS DISTINCT FROM OLD.profile_glow) THEN
      RAISE EXCEPTION 'Spark Plus is required for this customization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_protect_spark_plus ON public.profiles;
CREATE TRIGGER profiles_protect_spark_plus BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_spark_plus_fields();
