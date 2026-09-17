ALTER FUNCTION public.touch_updated_at() SET search_path = public;

REVOKE ALL ON FUNCTION public.guard_conversation_privileged_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_first_video_moderation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_pending_video_review() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.rename_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_group(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_group_avatar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_avatar(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_group_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_owner(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_daily_quest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_ad_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.community_create_channel(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_create_channel(uuid, uuid, text, text) TO authenticated, service_role;