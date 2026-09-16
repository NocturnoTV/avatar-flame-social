-- Block posting a new video while the user already has one awaiting manual
-- moderation review, on top of the existing first-video-goes-to-review rule.
create or replace function public.enforce_first_video_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _count int;
declare _has_pending boolean;
begin
  select exists(
    select 1 from public.videos where user_id = new.user_id and moderation_status = 'pending'
  ) into _has_pending;
  if _has_pending then
    raise exception 'pending_video_exists' using errcode = 'P0001';
  end if;

  select count(*) into _count from public.videos where user_id = new.user_id;
  if _count = 0 then
    new.moderation_status := 'pending';
  else
    new.moderation_status := 'approved';
  end if;
  return new;
end;
$$;
