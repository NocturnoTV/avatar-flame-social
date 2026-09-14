-- views_count was counting distinct viewers (video_views had a unique
-- constraint on (video_id, viewer_id), and the count trigger just counts
-- rows). The product requirement is "how many times this video was
-- watched", not "how many people watched it" - dropping the constraint
-- lets a fresh row (and therefore a fresh count) land on every view,
-- including repeat views. The client now does a plain insert instead of an
-- upsert with ignoreDuplicates (see discover.index.tsx / ProfileContentTabs.tsx).
alter table public.video_views drop constraint if exists video_views_unique_viewer;
