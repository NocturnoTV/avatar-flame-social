-- Video activity notifications (likes/favorites/reposts/comments) used to
-- bake a pre-rendered French sentence straight into `body` at insert time.
-- That can never be re-localized later, so switch to storing only the raw
-- data a client needs to render it (actor_id was already tracked; body now
-- carries just the comment snippet when relevant, NULL otherwise) - the
-- client renders the actual sentence in the viewer's *current* language via
-- src/lib/activityNotifications.ts.
--
-- Also splits "commented on your video" (video_comment) from "replied to
-- your comment" (new: video_comment_reply), since these render as different
-- sentences client-side.
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'video_comment_reply';

CREATE OR REPLACE FUNCTION public.notify_video_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, kind, actor_id, body)
  VALUES (_owner, 'video_like', NEW.user_id, NULL);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_video_favorite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, kind, actor_id, body)
  VALUES (_owner, 'video_favorite', NEW.user_id, NULL);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_video_repost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, kind, actor_id, body)
  VALUES (_owner, 'video_repost', NEW.user_id, NULL);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_video_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID; _parent_author UUID;
BEGIN
  SELECT user_id INTO _owner FROM public.videos WHERE id = NEW.video_id;

  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, kind, actor_id, body)
    VALUES (_owner, 'video_comment', NEW.user_id, LEFT(COALESCE(NEW.content, ''), 100));
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO _parent_author FROM public.video_comments WHERE id = NEW.parent_id;
    IF _parent_author IS NOT NULL AND _parent_author <> NEW.user_id AND _parent_author IS DISTINCT FROM _owner THEN
      INSERT INTO public.notifications (user_id, kind, actor_id, body)
      VALUES (_parent_author, 'video_comment_reply', NEW.user_id, LEFT(COALESCE(NEW.content, ''), 100));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
