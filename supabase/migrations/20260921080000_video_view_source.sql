-- Where a view actually came from - the client now sends "foryou",
-- "following", or "direct" (a deep link: a shared link, a notification, a
-- reposted/profile video click) alongside each real view insert. Nullable
-- since old rows and any other insert path never set it.
alter table public.video_views add column if not exists source text;
