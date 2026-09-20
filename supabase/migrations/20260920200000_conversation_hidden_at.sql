-- "Delete conversation" (1:1 DMs) hides it from that person's own list
-- without touching the shared row/messages - the other participant is
-- unaffected. A new incoming message automatically un-hides it again for
-- the recipient, matching how most chat apps handle this.
alter table public.conversation_participants add column hidden_at timestamptz;

create or replace function public.unhide_conversation_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_participants
    set hidden_at = null
    where conversation_id = new.conversation_id
      and user_id != new.sender_id
      and hidden_at is not null;
  return new;
end;
$$;

create trigger trg_unhide_conversation_on_new_message
after insert on public.messages
for each row execute function public.unhide_conversation_on_new_message();
