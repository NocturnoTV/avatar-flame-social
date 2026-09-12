
CREATE POLICY "read profile photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos');
CREATE POLICY "upload own profile photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "update own profile photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "delete own profile photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "read voice messages" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-messages');
CREATE POLICY "upload own voice messages" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-messages' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "delete own voice messages" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-messages' AND (storage.foldername(name))[1] = auth.uid()::text);
