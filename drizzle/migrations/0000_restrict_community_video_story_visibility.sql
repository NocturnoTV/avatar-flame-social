-- 1. Community visibility helper
CREATE OR REPLACE FUNCTION public.can_view_community(_community uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = _community
      AND (
        c.visibility = 'public'
        OR c.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c.id AND m.user_id = auth.uid())
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_community(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_community(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "communities readable" ON public.communities;
CREATE POLICY "communities readable" ON public.communities FOR SELECT TO authenticated
USING (visibility = 'public' OR owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = communities.id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "community_members readable" ON public.community_members;
CREATE POLICY "community_members readable" ON public.community_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_posts readable" ON public.community_posts;
CREATE POLICY "community_posts readable" ON public.community_posts FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_channels_read_all" ON public.community_channels;
CREATE POLICY "community_channels_read_all" ON public.community_channels FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_channel_categories_read_all" ON public.community_channel_categories;
CREATE POLICY "community_channel_categories_read_all" ON public.community_channel_categories FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_games_read_all" ON public.community_games;
CREATE POLICY "community_games_read_all" ON public.community_games FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_roles_read_all" ON public.community_roles;
CREATE POLICY "community_roles_read_all" ON public.community_roles FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_member_roles_read_all" ON public.community_member_roles;
CREATE POLICY "community_member_roles_read_all" ON public.community_member_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_threads readable" ON public.community_threads;
CREATE POLICY "community_threads readable" ON public.community_threads FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_lfg_posts readable" ON public.community_lfg_posts;
CREATE POLICY "community_lfg_posts readable" ON public.community_lfg_posts FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_events readable" ON public.community_events;
CREATE POLICY "community_events readable" ON public.community_events FOR SELECT TO authenticated
USING (public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_media readable" ON public.community_media;
CREATE POLICY "community_media readable" ON public.community_media FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_view_community(community_id));

DROP POLICY IF EXISTS "community_affiliates_read_all" ON public.community_affiliates;
CREATE POLICY "community_affiliates_read_all" ON public.community_affiliates FOR SELECT TO authenticated
USING (public.can_view_community(community_id) OR public.can_view_community(affiliate_id));

-- 2. Limit anonymous profile columns
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, roblox_username, roblox_display_name, roblox_avatar_url,
  language, bio, theme, accent_color, banner_style, frame_style, sticker,
  avatar_url, banner_url, verified, verified_at, onboarding_completed,
  country, link_url, spark_badges, profile_font, profile_glow, created_at
) ON public.profiles TO anon;

-- 3. Comments follow the parent video's visibility
DROP POLICY IF EXISTS "comments_select" ON public.video_comments;
CREATE POLICY "comments_select" ON public.video_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_comments.video_id));

-- 4. Story media in storage follows the stories table
DROP POLICY IF EXISTS "stories readable by members" ON storage.objects;
CREATE POLICY "stories readable by members" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'stories'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.media_url = 'stories/' || name)
  )
);

-- 5. Video files in storage follow the videos table
DROP POLICY IF EXISTS "anon read videos bucket" ON storage.objects;
CREATE POLICY "anon read videos bucket" ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'videos'
  AND EXISTS (
    SELECT 1 FROM public.videos v
    WHERE v.storage_path = 'videos/' || name OR v.thumbnail_path = 'videos/' || name
  )
);

DROP POLICY IF EXISTS "videos_bucket_read" ON storage.objects;
CREATE POLICY "videos_bucket_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'videos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.storage_path = 'videos/' || name OR v.thumbnail_path = 'videos/' || name
    )
  )
);