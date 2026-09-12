
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_username_cooldown() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_blocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.perform_swipe(UUID, public.swipe_action) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spark_deck(INT, TEXT, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_group(TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_swipe(UUID, public.swipe_action) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spark_deck(INT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, UUID[]) TO authenticated;
