-- One winner per giveaway, picked by staff from the real participant list.
alter table public.events add column if not exists winner_id uuid references public.profiles(id) on delete set null;
