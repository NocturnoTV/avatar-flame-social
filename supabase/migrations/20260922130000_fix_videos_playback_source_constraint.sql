-- The original videos_has_playback_source constraint required storage_path
-- or mux_upload_id to already be set at insert time. Studio's publish()
-- flow inserts the videos row FIRST (storage_path null, mux_status
-- "uploading") and only learns mux_upload_id afterward, once Mux's upload
-- URL has been minted - so every new Discover upload was failing the check
-- constraint immediately on insert. mux_status being set is just as valid a
-- signal that this row is Mux-pending.

alter table public.videos drop constraint if exists videos_has_playback_source;
alter table public.videos add constraint videos_has_playback_source
  check (storage_path is not null or mux_upload_id is not null or mux_status is not null);
