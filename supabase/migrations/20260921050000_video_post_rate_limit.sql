-- One video publish per 30 minutes per account, to slow down accidental
-- double-posts and outright spam/flooding without needing a separate
-- moderation queue for it.
create or replace function public.enforce_video_post_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare _last timestamptz;
begin
  select created_at into _last from public.videos
  where user_id = new.user_id
  order by created_at desc
  limit 1;
  if _last is not null and now() - _last < interval '30 minutes' then
    raise exception 'rate_limited: %', ceil(extract(epoch from (interval '30 minutes' - (now() - _last))) / 60)
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_video_post_rate_limit on public.videos;
create trigger trg_enforce_video_post_rate_limit
  before insert on public.videos
  for each row execute function public.enforce_video_post_rate_limit();
