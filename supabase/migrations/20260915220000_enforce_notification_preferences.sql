-- profiles.notification_prefs already existed and Settings already wrote to
-- it (see src/routes/_authenticated/settings.tsx), but nothing ever READ it
-- before inserting a notification - every toggle was purely decorative.
-- Enforcing it here, at insert time on the notifications table itself,
-- covers every existing call site (client code and other triggers) without
-- having to patch each one individually - the same defense-in-depth pattern
-- used elsewhere this session (first-video moderation, community visibility).
--
-- Safety-critical Team Spark messages (a moderation warning, a dispute
-- outcome, a generic safety alert) are never silenced, even by "paused" -
-- a user must not be able to hide the one message telling them their
-- account is at risk.
create or replace function public.enforce_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs jsonb;
  paused boolean;
  category text;
  is_critical boolean := false;
begin
  select notification_prefs into prefs from public.profiles where id = new.user_id;
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

drop trigger if exists trg_enforce_notification_preferences on public.notifications;
create trigger trg_enforce_notification_preferences
  before insert on public.notifications
  for each row execute function public.enforce_notification_preferences();
