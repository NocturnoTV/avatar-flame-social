-- Split into its own migration/transaction: PostgreSQL won't let a newly
-- added enum value be used in the same transaction that adds it.
alter type public.notification_kind add value if not exists 'video_comment_like';
