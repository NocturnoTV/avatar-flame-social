-- Communities: a social space around a shared game/interest (not a Discord
-- clone — no channels/servers). MVP covers discovery, join/leave, and a
-- simple post feed; the schema leaves room for discussions/events/media/LFG
-- to be added later without reshaping what's here.

CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('games','development','creators','roleplay','competitive','social','building','community','other')),
  language TEXT NOT NULL DEFAULT 'fr',
  game_name TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  banner_url TEXT,
  icon_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  rules TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "communities readable" ON public.communities;
CREATE POLICY "communities readable" ON public.communities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "communities create" ON public.communities;
CREATE POLICY "communities create" ON public.communities FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "communities owner update" ON public.communities;
CREATE POLICY "communities owner update" ON public.communities FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "communities owner delete" ON public.communities;
CREATE POLICY "communities owner delete" ON public.communities FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','moderator','contributor','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_members readable" ON public.community_members;
CREATE POLICY "community_members readable" ON public.community_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_members join" ON public.community_members;
CREATE POLICY "community_members join" ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "community_members leave" ON public.community_members;
CREATE POLICY "community_members leave" ON public.community_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts readable" ON public.community_posts;
CREATE POLICY "community_posts readable" ON public.community_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_posts create" ON public.community_posts;
CREATE POLICY "community_posts create" ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id AND cm.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "community_posts owner manage" ON public.community_posts;
CREATE POLICY "community_posts owner manage" ON public.community_posts FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "community_posts delete" ON public.community_posts;
CREATE POLICY "community_posts delete" ON public.community_posts FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.community_post_likes (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_post_likes TO authenticated;
GRANT ALL ON public.community_post_likes TO service_role;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_post_likes readable" ON public.community_post_likes;
CREATE POLICY "community_post_likes readable" ON public.community_post_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_post_likes write" ON public.community_post_likes;
CREATE POLICY "community_post_likes write" ON public.community_post_likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Keep member_count / likes_count / comments_count accurate via triggers.
CREATE OR REPLACE FUNCTION public.community_member_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.community_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS community_members_count ON public.community_members;
CREATE TRIGGER community_members_count AFTER INSERT OR DELETE ON public.community_members
FOR EACH ROW EXECUTE FUNCTION public.community_member_count_touch();

CREATE OR REPLACE FUNCTION public.community_owner_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS communities_owner_join ON public.communities;
CREATE TRIGGER communities_owner_join AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.community_owner_membership();

CREATE OR REPLACE FUNCTION public.community_post_likes_count_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS community_post_likes_count ON public.community_post_likes;
CREATE TRIGGER community_post_likes_count AFTER INSERT OR DELETE ON public.community_post_likes
FOR EACH ROW EXECUTE FUNCTION public.community_post_likes_count_touch();

CREATE INDEX IF NOT EXISTS communities_category_idx ON public.communities(category);
CREATE INDEX IF NOT EXISTS communities_member_count_idx ON public.communities(member_count DESC);
CREATE INDEX IF NOT EXISTS community_members_user_idx ON public.community_members(user_id);
CREATE INDEX IF NOT EXISTS community_posts_community_idx ON public.community_posts(community_id, created_at DESC);
