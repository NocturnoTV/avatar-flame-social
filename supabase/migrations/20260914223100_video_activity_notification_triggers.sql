-- Video likes/favorites/reposts/comments never generated a notification for
-- the creator before - only view/like/comment/etc. counters were bumped.
-- Each trigger skips self-actions and bakes the actor's username straight
-- into `body` (matches the existing notify_new_message() convention) so the
-- Team Spark thread can render it as-is with no extra client-side join.
CREATE OR REPLACE FUNCTION public.notify_video_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID; _actor_name TEXT;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(username, 'Quelqu''un') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, actor_id, body)
  VALUES (_owner, 'video_like', NEW.user_id, _actor_name || ' a aimé ta vidéo 💜');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS video_likes_notify ON public.video_likes;
CREATE TRIGGER video_likes_notify AFTER INSERT ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_video_like();

CREATE OR REPLACE FUNCTION public.notify_video_favorite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID; _actor_name TEXT;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(username, 'Quelqu''un') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, actor_id, body)
  VALUES (_owner, 'video_favorite', NEW.user_id, _actor_name || ' a mis ta vidéo en favoris ⭐');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS video_favorites_notify ON public.video_favorites;
CREATE TRIGGER video_favorites_notify AFTER INSERT ON public.video_favorites
FOR EACH ROW EXECUTE FUNCTION public.notify_video_favorite();

CREATE OR REPLACE FUNCTION public.notify_video_repost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID; _actor_name TEXT;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(username, 'Quelqu''un') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, kind, actor_id, body)
  VALUES (_owner, 'video_repost', NEW.user_id, _actor_name || ' a republié ta vidéo 🔁');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS video_reposts_notify ON public.video_reposts;
CREATE TRIGGER video_reposts_notify AFTER INSERT ON public.video_reposts
FOR EACH ROW EXECUTE FUNCTION public.notify_video_repost();

-- Comments notify the video owner, and separately notify the parent
-- comment's author when it's a reply (skipping a duplicate if that's the
-- same person as the video owner).
CREATE OR REPLACE FUNCTION public.notify_video_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID; _parent_author UUID; _actor_name TEXT;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  SELECT COALESCE(username, 'Quelqu''un') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;

  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, kind, actor_id, body)
    VALUES (_owner, 'video_comment', NEW.user_id, _actor_name || ' a commenté ta vidéo 💬 : ' || LEFT(COALESCE(NEW.content, ''), 100));
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO _parent_author FROM public.video_comments WHERE id = NEW.parent_id;
    IF _parent_author IS NOT NULL AND _parent_author <> NEW.user_id AND _parent_author IS DISTINCT FROM _owner THEN
      INSERT INTO public.notifications (user_id, kind, actor_id, body)
      VALUES (_parent_author, 'video_comment', NEW.user_id, _actor_name || ' a répondu à ton commentaire 💬 : ' || LEFT(COALESCE(NEW.content, ''), 100));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS video_comments_notify ON public.video_comments;
CREATE TRIGGER video_comments_notify AFTER INSERT ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_video_comment();
