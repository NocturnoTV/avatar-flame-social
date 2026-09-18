-- Community tables: scope reads to communities the caller can actually see.
DROP POLICY IF EXISTS "community_thread_replies readable" ON public.community_thread_replies;
CREATE POLICY "community_thread_replies readable" ON public.community_thread_replies
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.community_threads t
      WHERE t.id = community_thread_replies.thread_id
        AND public.can_view_community(t.community_id)
    )
  );

DROP POLICY IF EXISTS "community_media_likes readable" ON public.community_media_likes;
CREATE POLICY "community_media_likes readable" ON public.community_media_likes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.community_media m
      WHERE m.id = community_media_likes.media_id
        AND public.can_view_community(m.community_id)
    )
  );

DROP POLICY IF EXISTS "community_post_likes readable" ON public.community_post_likes;
CREATE POLICY "community_post_likes readable" ON public.community_post_likes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = community_post_likes.post_id
        AND public.can_view_community(p.community_id)
    )
  );

DROP POLICY IF EXISTS "community_event_rsvps readable" ON public.community_event_rsvps;
CREATE POLICY "community_event_rsvps readable" ON public.community_event_rsvps
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.community_events e
      WHERE e.id = community_event_rsvps.event_id
        AND public.can_view_community(e.community_id)
    )
  );

DROP POLICY IF EXISTS "community_xp_events readable" ON public.community_xp_events;
CREATE POLICY "community_xp_events readable" ON public.community_xp_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_view_community(community_id)
  );

-- Social graph / engagement tables: bind reads to the caller and to content the
-- caller is not blocked from.
DROP POLICY IF EXISTS "follows_select" ON public.follows;
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT TO authenticated
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR (
      NOT public.is_blocked(auth.uid(), follower_id)
      AND NOT public.is_blocked(auth.uid(), following_id)
    )
  );

DROP POLICY IF EXISTS "likes_select" ON public.video_likes;
CREATE POLICY "likes_select" ON public.video_likes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_likes.video_id)
  );

DROP POLICY IF EXISTS "repost_select" ON public.video_reposts;
CREATE POLICY "repost_select" ON public.video_reposts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_reposts.video_id)
  );

DROP POLICY IF EXISTS "comment_reactions_readable" ON public.video_comment_reactions;
CREATE POLICY "comment_reactions_readable" ON public.video_comment_reactions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.video_comments c WHERE c.id = video_comment_reactions.comment_id)
  );

DROP POLICY IF EXISTS "categories readable" ON public.video_categories;
CREATE POLICY "categories readable" ON public.video_categories
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_categories.video_id));

-- Feed posts and their engagement rows.
DROP POLICY IF EXISTS "feed_posts_read_all" ON public.feed_posts;
CREATE POLICY "feed_posts_read_all" ON public.feed_posts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "feed_post_likes_read_all" ON public.feed_post_likes;
CREATE POLICY "feed_post_likes_read_all" ON public.feed_post_likes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = feed_post_likes.post_id)
  );

DROP POLICY IF EXISTS "feed_post_replies_read_all" ON public.feed_post_replies;
CREATE POLICY "feed_post_replies_read_all" ON public.feed_post_replies
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = feed_post_replies.post_id)
  );

DROP POLICY IF EXISTS "feed_post_reposts_read_all" ON public.feed_post_reposts;
CREATE POLICY "feed_post_reposts_read_all" ON public.feed_post_reposts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = feed_post_reposts.post_id)
  );

-- News engagement: only rows attached to an article the caller can read.
DROP POLICY IF EXISTS "news_article_likes_read_all" ON public.news_article_likes;
CREATE POLICY "news_article_likes_read_all" ON public.news_article_likes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.news_articles a WHERE a.id = news_article_likes.article_id)
  );

DROP POLICY IF EXISTS "news_article_comments_read_all" ON public.news_article_comments;
CREATE POLICY "news_article_comments_read_all" ON public.news_article_comments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.news_articles a WHERE a.id = news_article_comments.article_id)
  );

-- Events are only surfaced inside the signed-in app.
DROP POLICY IF EXISTS "events_read_all" ON public.events;
CREATE POLICY "events_read_all" ON public.events
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "event_participants_read_all" ON public.event_participants;
CREATE POLICY "event_participants_read_all" ON public.event_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_participants.event_id)
  );

-- Badges: your own inventory, plus badges other people chose to display.
DROP POLICY IF EXISTS "user_badges_select_all" ON public.user_badges;
CREATE POLICY "user_badges_select_all" ON public.user_badges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR equipped IS TRUE);

-- Service status / incidents are only read from the signed-in support page.
DROP POLICY IF EXISTS "status readable" ON public.service_status;
CREATE POLICY "status readable" ON public.service_status
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "incidents readable" ON public.service_incidents;
CREATE POLICY "incidents readable" ON public.service_incidents
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Storage: bind object reads to the uploader or to a row that references them.
DROP POLICY IF EXISTS "news_articles_bucket_read" ON storage.objects;
CREATE POLICY "news_articles_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'news-articles'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.news_articles a
        WHERE a.image_url LIKE '%' || objects.name
      )
    )
  );

DROP POLICY IF EXISTS "thumbnails_bucket_read" ON storage.objects;
CREATE POLICY "thumbnails_bucket_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'thumbnails'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.videos v
        WHERE v.thumbnail_path = 'thumbnails/' || objects.name
      )
    )
  );

DROP POLICY IF EXISTS "feed_posts_bucket_read" ON storage.objects;
CREATE POLICY "feed_posts_bucket_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feed-posts'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.feed_posts p
        WHERE p.image_url LIKE '%' || objects.name
      )
    )
  );

DROP POLICY IF EXISTS "videos_bucket_read" ON storage.objects;
CREATE POLICY "videos_bucket_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'videos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.videos v
        WHERE v.storage_path = 'videos/' || objects.name
           OR v.thumbnail_path = 'videos/' || objects.name
      )
    )
  );

DROP POLICY IF EXISTS "anon read videos bucket" ON storage.objects;
CREATE POLICY "anon read videos bucket" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'videos'
    AND EXISTS (
      SELECT 1 FROM public.videos v
      WHERE (v.storage_path = 'videos/' || objects.name
             OR v.thumbnail_path = 'videos/' || objects.name)
        AND v.visibility = 'public'
        AND v.moderation_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "stories readable by members" ON storage.objects;
CREATE POLICY "stories readable by members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.stories s
        WHERE s.media_url = 'stories/' || objects.name
          AND s.expires_at > now()
          AND NOT public.is_blocked(auth.uid(), s.user_id)
      )
    )
  );