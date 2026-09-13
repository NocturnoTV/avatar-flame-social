CREATE TABLE IF NOT EXISTS public.video_comment_reactions (
  comment_id UUID NOT NULL REFERENCES public.video_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.video_comment_reactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comment_reactions TO authenticated;
GRANT ALL ON public.video_comment_reactions TO service_role;

CREATE POLICY "comment_reactions_readable" ON public.video_comment_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment_reactions_insert_own" ON public.video_comment_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comment_reactions_update_own" ON public.video_comment_reactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "comment_reactions_delete_own" ON public.video_comment_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS video_comment_reactions_comment_idx
  ON public.video_comment_reactions(comment_id);
