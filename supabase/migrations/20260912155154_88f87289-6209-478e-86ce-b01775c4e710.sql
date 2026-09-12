-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','moderator'));
$$;
REVOKE ALL ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated, service_role;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed admin (verified email match)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'arthur.buchon@outlook.fr'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_seed_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'arthur.buchon@outlook.fr' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_seed_admin
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_seed_admin();

-- PROFILES additions
ALTER TABLE public.profiles
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN banner_url TEXT,
  ADD COLUMN verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN notification_prefs JSONB NOT NULL DEFAULT '{"matches":true,"likes":true,"messages":true,"followers":true,"comments":true,"announcements":true,"paused":false}'::jsonb,
  ADD COLUMN privacy_prefs JSONB NOT NULL DEFAULT '{"discoverable":true,"show_age":true,"show_activity":true,"messages_from":"matches"}'::jsonb,
  ADD COLUMN deletion_requested_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.protect_verified()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.verified IS DISTINCT FROM OLD.verified) AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'verified_admin_only';
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    NEW.verified_at = CASE WHEN NEW.verified THEN now() ELSE NULL END;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER profiles_protect_verified BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_verified();

CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- FAVORITE ROBLOX GAMES
CREATE TABLE public.roblox_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roblox_games TO authenticated;
GRANT ALL ON public.roblox_games TO service_role;
ALTER TABLE public.roblox_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own games" ON public.roblox_games FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "games readable" ON public.roblox_games FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), user_id));
CREATE INDEX roblox_games_user_idx ON public.roblox_games(user_id, position);

CREATE OR REPLACE FUNCTION public.limit_roblox_games()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.roblox_games WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'max_five_games';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER roblox_games_limit BEFORE INSERT ON public.roblox_games
FOR EACH ROW EXECUTE FUNCTION public.limit_roblox_games();

-- REPORTS moderation
ALTER TABLE public.reports
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN handled_by UUID REFERENCES auth.users(id),
  ADD COLUMN handled_at TIMESTAMPTZ,
  ADD COLUMN moderator_note TEXT;

CREATE POLICY "staff read reports" ON public.reports FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update reports" ON public.reports FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- MODERATION READ ACCESS
CREATE POLICY "staff read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read participants" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read matches" ON public.matches FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- AUDIT LOG
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read audit" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write audit" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid() AND public.is_staff(auth.uid()));

-- DATA REQUESTS (GDPR)
CREATE TABLE public.data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_requests TO authenticated;
GRANT ALL ON public.data_requests TO service_role;
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data requests" ON public.data_requests FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff read data requests" ON public.data_requests FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER data_requests_touch BEFORE UPDATE ON public.data_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();