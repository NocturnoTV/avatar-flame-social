-- Communities, Discord-style: channels/categories, custom roles with
-- permissions, member management (kick/ban/roles), ownership transfer,
-- affiliated communities, audit log, multi-game association, 3-state
-- visibility.

-- ---------- visibility (public / private_request / private_friends) ----------
ALTER TABLE public.communities DROP CONSTRAINT IF EXISTS communities_visibility_check;
UPDATE public.communities SET visibility = 'private_request' WHERE visibility = 'private';
ALTER TABLE public.communities
  ADD CONSTRAINT communities_visibility_check
  CHECK (visibility IN ('public', 'private_request', 'private_friends'));

-- ---------- multiple Roblox games per community (max 5) ----------
CREATE TABLE IF NOT EXISTS public.community_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  roblox_universe_id TEXT,
  thumbnail_url TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_games_community_idx ON public.community_games (community_id, position);
GRANT SELECT ON public.community_games TO authenticated;
GRANT ALL ON public.community_games TO service_role;
ALTER TABLE public.community_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_games_read_all" ON public.community_games;
CREATE POLICY "community_games_read_all" ON public.community_games FOR SELECT TO authenticated USING (true);

-- ---------- channel categories & channels ----------
CREATE TABLE IF NOT EXISTS public.community_channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_channel_categories TO authenticated;
GRANT ALL ON public.community_channel_categories TO service_role;
ALTER TABLE public.community_channel_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_channel_categories_read_all" ON public.community_channel_categories;
CREATE POLICY "community_channel_categories_read_all" ON public.community_channel_categories FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.community_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.community_channel_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_channels_community_idx ON public.community_channels (community_id, position);
GRANT SELECT ON public.community_channels TO authenticated;
GRANT ALL ON public.community_channels TO service_role;
ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_channels_read_all" ON public.community_channels;
CREATE POLICY "community_channels_read_all" ON public.community_channels FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.community_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_channel_messages_channel_idx ON public.community_channel_messages (channel_id, created_at);
GRANT SELECT ON public.community_channel_messages TO authenticated;
GRANT ALL ON public.community_channel_messages TO service_role;
ALTER TABLE public.community_channel_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_channel_messages_read_members" ON public.community_channel_messages;
CREATE POLICY "community_channel_messages_read_members" ON public.community_channel_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = community_channel_messages.community_id AND m.user_id = auth.uid()));
DROP POLICY IF EXISTS "community_channel_messages_insert_members" ON public.community_channel_messages;
CREATE POLICY "community_channel_messages_insert_members" ON public.community_channel_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = community_channel_messages.community_id AND m.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "community_channel_messages_delete_own" ON public.community_channel_messages;
CREATE POLICY "community_channel_messages_delete_own" ON public.community_channel_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------- custom roles with permissions ----------
CREATE TABLE IF NOT EXISTS public.community_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#A855F7',
  position INT NOT NULL DEFAULT 0,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_roles TO authenticated;
GRANT ALL ON public.community_roles TO service_role;
ALTER TABLE public.community_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_roles_read_all" ON public.community_roles;
CREATE POLICY "community_roles_read_all" ON public.community_roles FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.community_member_roles (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.community_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
GRANT SELECT ON public.community_member_roles TO authenticated;
GRANT ALL ON public.community_member_roles TO service_role;
ALTER TABLE public.community_member_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_member_roles_read_all" ON public.community_member_roles;
CREATE POLICY "community_member_roles_read_all" ON public.community_member_roles FOR SELECT TO authenticated USING (true);

-- ---------- bans ----------
CREATE TABLE IF NOT EXISTS public.community_bans (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
GRANT SELECT ON public.community_bans TO authenticated;
GRANT ALL ON public.community_bans TO service_role;
ALTER TABLE public.community_bans ENABLE ROW LEVEL SECURITY;
-- SELECT policy (permission-gated) added in the follow-up functions migration.

-- ---------- affiliated / partner communities ----------
CREATE TABLE IF NOT EXISTS public.community_affiliates (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, affiliate_id),
  CHECK (community_id <> affiliate_id)
);
GRANT SELECT ON public.community_affiliates TO authenticated;
GRANT ALL ON public.community_affiliates TO service_role;
ALTER TABLE public.community_affiliates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_affiliates_read_all" ON public.community_affiliates;
CREATE POLICY "community_affiliates_read_all" ON public.community_affiliates FOR SELECT TO authenticated USING (true);

-- ---------- audit log ----------
CREATE TABLE IF NOT EXISTS public.community_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_audit_log_community_idx ON public.community_audit_log (community_id, created_at DESC);
GRANT SELECT ON public.community_audit_log TO authenticated;
GRANT ALL ON public.community_audit_log TO service_role;
ALTER TABLE public.community_audit_log ENABLE ROW LEVEL SECURITY;
-- SELECT policy (permission-gated) added in the follow-up functions migration.
