-- Permission model + management RPCs for the Discord-style communities
-- rebuild. Clients never write directly to channels/categories/roles/
-- members/bans/affiliates — every mutation goes through one of these
-- SECURITY DEFINER functions, which check permissions themselves. This
-- keeps the permission logic in one place instead of duplicated RLS.

-- Valid permission strings (enforced in app code, not a DB enum, so new
-- ones can be added without a migration):
--   manage_community, manage_channels, manage_roles, manage_members,
--   view_audit_log, manage_affiliates

CREATE OR REPLACE FUNCTION public.community_has_permission(_community UUID, _user UUID, _perm TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.communities c WHERE c.id = _community AND c.owner_id = _user)
    OR EXISTS (
      SELECT 1 FROM public.community_member_roles mr
      JOIN public.community_roles r ON r.id = mr.role_id
      WHERE mr.community_id = _community AND mr.user_id = _user AND r.permissions @> ARRAY[_perm]
    );
$$;
REVOKE ALL ON FUNCTION public.community_has_permission(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_has_permission(UUID, UUID, TEXT) TO authenticated, service_role;

-- Now that the permission function exists, gate the sensitive read tables.
DROP POLICY IF EXISTS "community_bans_read_managers" ON public.community_bans;
CREATE POLICY "community_bans_read_managers" ON public.community_bans FOR SELECT TO authenticated
  USING (public.community_has_permission(community_id, auth.uid(), 'manage_members'));

DROP POLICY IF EXISTS "community_audit_log_read_managers" ON public.community_audit_log;
CREATE POLICY "community_audit_log_read_managers" ON public.community_audit_log FOR SELECT TO authenticated
  USING (public.community_has_permission(community_id, auth.uid(), 'view_audit_log'));

-- Owner + manage_community can also update the community profile (was
-- owner-only before).
DROP POLICY IF EXISTS "communities owner update" ON public.communities;
DROP POLICY IF EXISTS "communities managers update" ON public.communities;
CREATE POLICY "communities managers update" ON public.communities FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.community_has_permission(id, auth.uid(), 'manage_community'))
  WITH CHECK (owner_id = auth.uid() OR public.community_has_permission(id, auth.uid(), 'manage_community'));

CREATE OR REPLACE FUNCTION public.community_role_limit(_community UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p.spark_plus_active AND (p.spark_plus_expires_at IS NULL OR p.spark_plus_expires_at > now())
    THEN 2147483647 ELSE 10 END
  FROM public.communities c JOIN public.profiles p ON p.id = c.owner_id
  WHERE c.id = _community;
$$;

CREATE OR REPLACE FUNCTION public.community_affiliate_limit(_community UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p.spark_plus_active AND (p.spark_plus_expires_at IS NULL OR p.spark_plus_expires_at > now())
    THEN 2147483647 ELSE 5 END
  FROM public.communities c JOIN public.profiles p ON p.id = c.owner_id
  WHERE c.id = _community;
$$;

CREATE OR REPLACE FUNCTION public.log_community_action(_community UUID, _actor UUID, _action TEXT, _target UUID, _details TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.community_audit_log (community_id, actor_id, action, target_user_id, details)
  VALUES (_community, _actor, _action, _target, _details);
END; $$;

-- ---------- channels & categories ----------
CREATE OR REPLACE FUNCTION public.community_create_channel(_community UUID, _category UUID, _name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _pos INT;
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_channels') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.community_channels WHERE community_id = _community;
  INSERT INTO public.community_channels (community_id, category_id, name, position)
  VALUES (_community, _category, _name, _pos) RETURNING id INTO _id;
  PERFORM public.log_community_action(_community, auth.uid(), 'create_channel', NULL, _name);
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.community_create_channel(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_create_channel(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_rename_channel(_channel UUID, _name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID;
BEGIN
  SELECT community_id INTO _community FROM public.community_channels WHERE id = _channel;
  IF _community IS NULL OR NOT public.community_has_permission(_community, auth.uid(), 'manage_channels') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.community_channels SET name = _name WHERE id = _channel;
  PERFORM public.log_community_action(_community, auth.uid(), 'rename_channel', NULL, _name);
END; $$;
REVOKE ALL ON FUNCTION public.community_rename_channel(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_rename_channel(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_move_channel(_channel UUID, _category UUID, _position INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID;
BEGIN
  SELECT community_id INTO _community FROM public.community_channels WHERE id = _channel;
  IF _community IS NULL OR NOT public.community_has_permission(_community, auth.uid(), 'manage_channels') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.community_channels SET category_id = _category, position = _position WHERE id = _channel;
END; $$;
REVOKE ALL ON FUNCTION public.community_move_channel(UUID, UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_move_channel(UUID, UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_delete_channel(_channel UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID; _is_default BOOLEAN;
BEGIN
  SELECT community_id, is_default INTO _community, _is_default FROM public.community_channels WHERE id = _channel;
  IF _community IS NULL OR NOT public.community_has_permission(_community, auth.uid(), 'manage_channels') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _is_default THEN
    RAISE EXCEPTION 'cannot_delete_default_channel';
  END IF;
  DELETE FROM public.community_channels WHERE id = _channel;
  PERFORM public.log_community_action(_community, auth.uid(), 'delete_channel', NULL, NULL);
END; $$;
REVOKE ALL ON FUNCTION public.community_delete_channel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_delete_channel(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_create_category(_community UUID, _name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _pos INT;
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_channels') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.community_channel_categories WHERE community_id = _community;
  INSERT INTO public.community_channel_categories (community_id, name, position)
  VALUES (_community, _name, _pos) RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.community_create_category(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_create_category(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_delete_category(_category UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID;
BEGIN
  SELECT community_id INTO _community FROM public.community_channel_categories WHERE id = _category;
  IF _community IS NULL OR NOT public.community_has_permission(_community, auth.uid(), 'manage_channels') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  DELETE FROM public.community_channel_categories WHERE id = _category;
END; $$;
REVOKE ALL ON FUNCTION public.community_delete_category(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_delete_category(UUID) TO authenticated;

-- ---------- roles ----------
CREATE OR REPLACE FUNCTION public.community_create_role(_community UUID, _name TEXT, _color TEXT, _permissions TEXT[])
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _pos INT; _count INT; _limit INT;
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT count(*) INTO _count FROM public.community_roles WHERE community_id = _community;
  _limit := public.community_role_limit(_community);
  IF _count >= _limit THEN
    RAISE EXCEPTION 'role_limit_reached';
  END IF;
  SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.community_roles WHERE community_id = _community;
  INSERT INTO public.community_roles (community_id, name, color, position, permissions)
  VALUES (_community, _name, _color, _pos, _permissions) RETURNING id INTO _id;
  PERFORM public.log_community_action(_community, auth.uid(), 'create_role', NULL, _name);
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.community_create_role(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_create_role(UUID, TEXT, TEXT, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_update_role(_role UUID, _name TEXT, _color TEXT, _permissions TEXT[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID;
BEGIN
  SELECT community_id INTO _community FROM public.community_roles WHERE id = _role;
  IF _community IS NULL OR NOT public.community_has_permission(_community, auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.community_roles SET name = _name, color = _color, permissions = _permissions WHERE id = _role;
  PERFORM public.log_community_action(_community, auth.uid(), 'update_role', NULL, _name);
END; $$;
REVOKE ALL ON FUNCTION public.community_update_role(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_update_role(UUID, TEXT, TEXT, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_delete_role(_role UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID; _is_default BOOLEAN;
BEGIN
  SELECT community_id, is_default INTO _community, _is_default FROM public.community_roles WHERE id = _role;
  IF _community IS NULL OR NOT public.community_has_permission(_community, auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _is_default THEN
    RAISE EXCEPTION 'cannot_delete_default_role';
  END IF;
  DELETE FROM public.community_roles WHERE id = _role;
END; $$;
REVOKE ALL ON FUNCTION public.community_delete_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_delete_role(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_assign_role(_community UUID, _target UUID, _role UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  INSERT INTO public.community_member_roles (community_id, user_id, role_id)
  VALUES (_community, _target, _role) ON CONFLICT DO NOTHING;
  PERFORM public.log_community_action(_community, auth.uid(), 'assign_role', _target, NULL);
END; $$;
REVOKE ALL ON FUNCTION public.community_assign_role(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_assign_role(UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_unassign_role(_community UUID, _target UUID, _role UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  DELETE FROM public.community_member_roles WHERE community_id = _community AND user_id = _target AND role_id = _role;
  PERFORM public.log_community_action(_community, auth.uid(), 'unassign_role', _target, NULL);
END; $$;
REVOKE ALL ON FUNCTION public.community_unassign_role(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_unassign_role(UUID, UUID, UUID) TO authenticated;

-- ---------- member management ----------
CREATE OR REPLACE FUNCTION public.community_kick_member(_community UUID, _target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_members') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM public.communities WHERE id = _community AND owner_id = _target) THEN
    RAISE EXCEPTION 'cannot_remove_owner';
  END IF;
  DELETE FROM public.community_members WHERE community_id = _community AND user_id = _target;
  DELETE FROM public.community_member_roles WHERE community_id = _community AND user_id = _target;
  PERFORM public.log_community_action(_community, auth.uid(), 'kick', _target, NULL);
END; $$;
REVOKE ALL ON FUNCTION public.community_kick_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_kick_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_ban_member(_community UUID, _target UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_members') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM public.communities WHERE id = _community AND owner_id = _target) THEN
    RAISE EXCEPTION 'cannot_remove_owner';
  END IF;
  INSERT INTO public.community_bans (community_id, user_id, banned_by, reason)
  VALUES (_community, _target, auth.uid(), _reason)
  ON CONFLICT (community_id, user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by;
  DELETE FROM public.community_members WHERE community_id = _community AND user_id = _target;
  DELETE FROM public.community_member_roles WHERE community_id = _community AND user_id = _target;
  PERFORM public.log_community_action(_community, auth.uid(), 'ban', _target, _reason);
END; $$;
REVOKE ALL ON FUNCTION public.community_ban_member(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_ban_member(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_unban_member(_community UUID, _target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_members') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  DELETE FROM public.community_bans WHERE community_id = _community AND user_id = _target;
  PERFORM public.log_community_action(_community, auth.uid(), 'unban', _target, NULL);
END; $$;
REVOKE ALL ON FUNCTION public.community_unban_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_unban_member(UUID, UUID) TO authenticated;

-- ---------- ownership transfer (client re-verifies the password first) ----------
CREATE OR REPLACE FUNCTION public.community_transfer_ownership(_community UUID, _new_owner UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = _community AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = _community AND user_id = _new_owner) THEN
    RAISE EXCEPTION 'target_not_a_member';
  END IF;
  UPDATE public.communities SET owner_id = _new_owner WHERE id = _community;
  UPDATE public.community_members SET role = 'member' WHERE community_id = _community AND user_id = auth.uid();
  UPDATE public.community_members SET role = 'owner' WHERE community_id = _community AND user_id = _new_owner;
  PERFORM public.log_community_action(_community, auth.uid(), 'transfer_ownership', _new_owner, NULL);
END; $$;
REVOKE ALL ON FUNCTION public.community_transfer_ownership(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_transfer_ownership(UUID, UUID) TO authenticated;

-- ---------- games (max 5) ----------
CREATE OR REPLACE FUNCTION public.community_add_game(_community UUID, _name TEXT, _universe_id TEXT, _thumbnail TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _count INT; _pos INT;
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_community') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT count(*) INTO _count FROM public.community_games WHERE community_id = _community;
  IF _count >= 5 THEN
    RAISE EXCEPTION 'max_5_games';
  END IF;
  SELECT COALESCE(MAX(position), -1) + 1 INTO _pos FROM public.community_games WHERE community_id = _community;
  INSERT INTO public.community_games (community_id, name, roblox_universe_id, thumbnail_url, position)
  VALUES (_community, _name, _universe_id, _thumbnail, _pos) RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.community_add_game(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_add_game(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_remove_game(_game UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _community UUID;
BEGIN
  SELECT community_id INTO _community FROM public.community_games WHERE id = _game;
  IF _community IS NULL OR NOT public.community_has_permission(_community, auth.uid(), 'manage_community') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  DELETE FROM public.community_games WHERE id = _game;
END; $$;
REVOKE ALL ON FUNCTION public.community_remove_game(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_remove_game(UUID) TO authenticated;

-- ---------- affiliates (max 5, unlimited with Spark Plus) ----------
CREATE OR REPLACE FUNCTION public.community_add_affiliate(_community UUID, _affiliate UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count INT; _limit INT;
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_affiliates') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT count(*) INTO _count FROM public.community_affiliates WHERE community_id = _community;
  _limit := public.community_affiliate_limit(_community);
  IF _count >= _limit THEN
    RAISE EXCEPTION 'affiliate_limit_reached';
  END IF;
  INSERT INTO public.community_affiliates (community_id, affiliate_id) VALUES (_community, _affiliate)
  ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.community_add_affiliate(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_add_affiliate(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_remove_affiliate(_community UUID, _affiliate UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.community_has_permission(_community, auth.uid(), 'manage_affiliates') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  DELETE FROM public.community_affiliates WHERE community_id = _community AND affiliate_id = _affiliate;
END; $$;
REVOKE ALL ON FUNCTION public.community_remove_affiliate(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_remove_affiliate(UUID, UUID) TO authenticated;

-- Seed a default, non-deletable "Accueil" channel + an @everyone role for
-- every community that doesn't have one yet (existing communities from
-- before this migration).
INSERT INTO public.community_channels (community_id, name, position, is_default)
SELECT c.id, 'Accueil', 0, true
FROM public.communities c
WHERE NOT EXISTS (SELECT 1 FROM public.community_channels ch WHERE ch.community_id = c.id);

INSERT INTO public.community_roles (community_id, name, color, position, permissions, is_default)
SELECT c.id, '@everyone', '#8A8F98', 0, '{}', true
FROM public.communities c
WHERE NOT EXISTS (SELECT 1 FROM public.community_roles r WHERE r.community_id = c.id);

-- New communities get the same defaults automatically.
CREATE OR REPLACE FUNCTION public.community_seed_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.community_channels (community_id, name, position, is_default)
  VALUES (NEW.id, 'Accueil', 0, true);
  INSERT INTO public.community_roles (community_id, name, color, position, permissions, is_default)
  VALUES (NEW.id, '@everyone', '#8A8F98', 0, '{}', true);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS communities_seed_defaults ON public.communities;
CREATE TRIGGER communities_seed_defaults AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.community_seed_defaults();
