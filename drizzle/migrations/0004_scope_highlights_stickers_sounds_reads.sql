-- Story highlights: readable by their owner, or by other signed-in users
-- who are not blocked by the owner (instead of a blanket USING (true)).
DROP POLICY IF EXISTS "anyone can view highlights" ON public.story_highlights;
CREATE POLICY "highlights readable by non blocked users" ON public.story_highlights
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_blocked(user_id, auth.uid()));

DROP POLICY IF EXISTS "anyone can view highlight items" ON public.story_highlight_items;
CREATE POLICY "highlight items follow their highlight" ON public.story_highlight_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.story_highlights h
    WHERE h.id = story_highlight_items.highlight_id
      AND (h.user_id = auth.uid() OR NOT public.is_blocked(h.user_id, auth.uid()))
  ));

-- Stickers: same treatment - owner, or a signed-in user not blocked by the
-- sticker's author (recipients still need to render stickers sent to them).
DROP POLICY IF EXISTS "anyone can view stickers" ON public.stickers;
CREATE POLICY "stickers readable by non blocked users" ON public.stickers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_blocked(user_id, auth.uid()));

-- Storage: bind sticker/sound object reads to the owner folder or to a real
-- row in the matching table, instead of "any signed-in caller".
DROP POLICY IF EXISTS "stickers_bucket_read" ON storage.objects;
CREATE POLICY "stickers_bucket_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'stickers'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.stickers s
        WHERE s.storage_path = 'stickers/' || objects.name OR s.storage_path = objects.name
      )
    )
  );

DROP POLICY IF EXISTS "sounds_bucket_read" ON storage.objects;
CREATE POLICY "sounds_bucket_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sounds'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.sounds s
        WHERE (s.storage_path = 'sounds/' || objects.name OR s.storage_path = objects.name)
          AND (s.visibility = 'public' OR s.user_id = auth.uid())
      )
    )
  );
