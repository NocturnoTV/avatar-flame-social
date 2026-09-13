
CREATE POLICY "stories readable by members" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'stories');
CREATE POLICY "stories uploaded by owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "stories deleted by owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);
