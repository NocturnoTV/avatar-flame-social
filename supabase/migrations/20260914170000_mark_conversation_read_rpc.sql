-- The client previously wrote last_read_at using its own clock
-- (new Date().toISOString()). If a device's clock drifts even slightly
-- behind the DB server's, last_read_at could land earlier than a
-- last_message_at set with the server's now() moments before - leaving a
-- conversation stuck "unread" forever even though it was just opened. Doing
-- the update with Postgres's own now() removes that class of bug entirely.
create or replace function public.mark_conversation_read(_conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = _conversation and user_id = auth.uid();
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;
