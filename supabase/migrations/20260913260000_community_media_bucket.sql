INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "community_media_bucket_read" ON storage.objects;
CREATE POLICY "community_media_bucket_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-media');

DROP POLICY IF EXISTS "community_media_bucket_insert" ON storage.objects;
CREATE POLICY "community_media_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "community_media_bucket_delete" ON storage.objects;
CREATE POLICY "community_media_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-media' AND (storage.foldername(name))[1] = auth.uid()::text);
