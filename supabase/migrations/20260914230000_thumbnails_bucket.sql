-- Dedicated bucket for video thumbnails captured client-side from a frame of
-- the video (Creator Studio's thumbnail picker / video edit sheet). Not
-- reused from the "videos" bucket since uploadFile() forces the resumable
-- (TUS) upload path for anything in that bucket, which is unnecessary
-- overhead for a small JPEG frame.
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "thumbnails_bucket_read" ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

CREATE POLICY "thumbnails_bucket_insert" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "thumbnails_bucket_update" ON storage.objects FOR UPDATE
USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "thumbnails_bucket_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
