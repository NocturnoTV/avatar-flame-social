DROP POLICY IF EXISTS "comment_images_bucket_read" ON storage.objects;
CREATE POLICY "comment_images_bucket_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'comment-images'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.video_comments c
      WHERE c.media_url LIKE '%' || storage.objects.name
    )
  )
);