-- Hashtag typeahead for the video-publish wizard: given what someone has
-- typed so far, return matching tags and how many videos already use each,
-- most-used first.
create or replace function public.search_hashtags(_prefix text, _limit integer default 6)
returns table(tag text, uses bigint)
language sql
stable
security definer
set search_path = public
as $$
  select tag, count(*) as uses
  from public.videos, unnest(hashtags) as tag
  where tag ilike _prefix || '%'
    and moderation_status = 'approved'
  group by tag
  order by uses desc
  limit _limit;
$$;

revoke all on function public.search_hashtags(text, integer) from public, anon;
grant execute on function public.search_hashtags(text, integer) to authenticated;
