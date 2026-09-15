-- A brand-new account's very first video is held for review (AI + manual
-- moderation) instead of publishing immediately. Enforced server-side via a
-- trigger (not left to the client to set correctly) and gated in RLS so a
-- pending video is invisible to everyone but its owner and staff.

alter table public.videos add column if not exists moderation_status text not null default 'approved';
alter table public.videos add constraint videos_moderation_status_check check (moderation_status in ('pending','approved','rejected')) not valid;
alter table public.videos validate constraint videos_moderation_status_check;

drop policy if exists "anon read public videos" on public.videos;
create policy "anon read public videos" on public.videos
  for select using (visibility = 'public' and moderation_status = 'approved');

drop policy if exists "videos_select" on public.videos;
create policy "videos_select" on public.videos
  for select using (
    (visibility = 'public' and moderation_status = 'approved' and not is_blocked(auth.uid(), user_id))
    or user_id = auth.uid()
  );

create or replace function public.enforce_first_video_moderation()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare _count int;
begin
  select count(*) into _count from public.videos where user_id = new.user_id;
  if _count = 0 then
    new.moderation_status := 'pending';
  else
    new.moderation_status := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_first_video_moderation on public.videos;
create trigger trg_enforce_first_video_moderation before insert on public.videos
  for each row execute function public.enforce_first_video_moderation();

-- First Team Spark message: "your video is pending review" - rendered
-- client-side from this marker, same pattern as safety_alert/purchase_thanks.
create or replace function public.notify_pending_video_review()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.moderation_status = 'pending' then
    insert into public.notifications (user_id, kind, body, video_id)
    values (new.user_id, 'system', 'video_pending_review', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_pending_video_review on public.videos;
create trigger trg_notify_pending_video_review after insert on public.videos
  for each row execute function public.notify_pending_video_review();
