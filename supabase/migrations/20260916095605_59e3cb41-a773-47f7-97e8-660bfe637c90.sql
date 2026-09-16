
ALTER TABLE public.profiles_private
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS privacy_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.profiles_private (user_id)
SELECT p.id FROM public.profiles p
LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
WHERE pp.user_id IS NULL;

UPDATE public.profiles_private pp
SET moderation_status = coalesce(p.moderation_status, 'active'),
    moderation_note = p.moderation_note,
    warning_count = coalesce(p.warning_count, 0),
    banned_until = p.banned_until,
    notification_prefs = coalesce(p.notification_prefs, '{}'::jsonb),
    privacy_prefs = coalesce(p.privacy_prefs, '{}'::jsonb)
FROM public.profiles p
WHERE p.id = pp.user_id;

CREATE OR REPLACE FUNCTION public.enforce_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  prefs jsonb;
  paused boolean;
  category text;
  is_critical boolean := false;
begin
  select notification_prefs into prefs from public.profiles_private where user_id = new.user_id;
  prefs := coalesce(prefs, '{}'::jsonb);
  paused := coalesce((prefs->>'paused')::boolean, false);

  if new.kind = 'system' and new.body is not null and (
    new.body like 'moderation_warning:%'
    or new.body in ('dispute_accepted', 'dispute_rejected', 'safety_alert')
  ) then
    is_critical := true;
  end if;

  if is_critical then
    return new;
  end if;

  if paused then
    return null;
  end if;

  category := case new.kind
    when 'match' then 'matches'
    when 'like' then 'likes'
    when 'super' then 'likes'
    when 'message' then 'messages'
    when 'video_comment' then 'comments'
    when 'video_comment_reply' then 'comments'
    when 'video_like' then 'activity'
    when 'video_favorite' then 'activity'
    when 'video_repost' then 'activity'
    when 'video_mention' then 'activity'
    when 'system' then 'announcements'
    else null
  end;

  if category is not null and (prefs ? category) and (prefs->>category)::boolean = false then
    return null;
  end if;

  return new;
end;
$$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS moderation_status,
  DROP COLUMN IF EXISTS moderation_note,
  DROP COLUMN IF EXISTS warning_count,
  DROP COLUMN IF EXISTS banned_until,
  DROP COLUMN IF EXISTS notification_prefs,
  DROP COLUMN IF EXISTS privacy_prefs;
