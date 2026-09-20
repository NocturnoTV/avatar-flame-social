-- 1. Server-derived boost pricing: the caller can no longer choose the price.
create or replace function public.boost_video(_video uuid, _blox_cost integer, _hours integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _user uuid := auth.uid();
  _owner uuid;
  _balance integer;
  _current_boost timestamptz;
  _base timestamptz;
  _cost integer;
begin
  if _user is null then raise exception 'not_authenticated'; end if;

  -- Price and duration come from the server-side tier table, never the caller.
  _cost := case _hours
    when 1 then 500
    when 3 then 1000
    when 6 then 1750
    when 12 then 3000
    when 24 then 5000
    else null
  end;
  if _cost is null then raise exception 'invalid_boost'; end if;

  select user_id, boosted_until into _owner, _current_boost from public.videos where id = _video;
  if _owner is null then raise exception 'video_not_found'; end if;
  if _owner <> _user then raise exception 'not_your_video'; end if;

  select blox_balance into _balance from public.profiles where id = _user for update;
  if _balance is null or _balance < _cost then raise exception 'insufficient_balance'; end if;

  _base := greatest(coalesce(_current_boost, now()), now());

  update public.profiles set blox_balance = blox_balance - _cost where id = _user;
  update public.videos set boosted_until = _base + make_interval(hours => _hours) where id = _video;
  insert into public.blox_transactions (user_id, amount, kind, reference_id, description)
  values (_user, -_cost, 'purchase', _video::text, 'Boost vidéo (' || _hours || 'h)');
end;
$$;

revoke all on function public.boost_video(uuid, integer, integer) from public, anon;
grant execute on function public.boost_video(uuid, integer, integer) to authenticated, service_role;

-- 2. Storage reads: every object must belong to the caller or back a moderated,
-- actually-visible row.
drop policy if exists "videos_bucket_read" on storage.objects;
create policy "videos_bucket_read" on storage.objects for select to authenticated
using (
  bucket_id = 'videos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.videos v
      where (v.storage_path = 'videos/' || storage.objects.name
             or v.thumbnail_path = 'videos/' || storage.objects.name)
        and v.moderation_status = 'approved'
    )
  )
);

drop policy if exists "thumbnails_bucket_read" on storage.objects;
create policy "thumbnails_bucket_read" on storage.objects for select to anon, authenticated
using (
  bucket_id = 'thumbnails'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.videos v
      where v.thumbnail_path = 'thumbnails/' || storage.objects.name
        and v.moderation_status = 'approved'
        and (v.visibility = 'public' or v.user_id = auth.uid())
    )
  )
);

drop policy if exists "news_articles_bucket_read" on storage.objects;
create policy "news_articles_bucket_read" on storage.objects for select to anon, authenticated
using (
  bucket_id = 'news-articles'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.news_articles a
      where a.image_url like '%' || storage.objects.name
        and a.status = 'published'
    )
  )
);

drop policy if exists "feed_posts_bucket_read" on storage.objects;
create policy "feed_posts_bucket_read" on storage.objects for select to authenticated
using (
  bucket_id = 'feed-posts'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.feed_posts p
      where p.image_url like '%' || storage.objects.name
    )
  )
);
