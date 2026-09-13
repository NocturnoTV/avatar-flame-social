DROP POLICY IF EXISTS "videos_select" ON public.videos;
CREATE POLICY "videos_select" ON public.videos
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    visibility = 'public'
    AND NOT public.is_blocked(auth.uid(), user_id)
  )
  OR (
    visibility = 'sparks'
    AND EXISTS (
      SELECT 1
      FROM public.follows
      WHERE follower_id = auth.uid()
        AND following_id = videos.user_id
    )
    AND NOT public.is_blocked(auth.uid(), user_id)
  )
);
