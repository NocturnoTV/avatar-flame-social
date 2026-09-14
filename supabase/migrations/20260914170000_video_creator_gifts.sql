CREATE OR REPLACE FUNCTION public.gift_video_creator(_video UUID, _amount INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender UUID := auth.uid();
  _creator UUID;
  _balance INTEGER;
  _comment UUID;
BEGIN
  IF _sender IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT user_id INTO _creator FROM public.videos WHERE id = _video;
  IF _creator IS NULL THEN RAISE EXCEPTION 'video_not_found'; END IF;
  IF _creator = _sender THEN RAISE EXCEPTION 'cannot_gift_self'; END IF;

  SELECT blox_balance INTO _balance FROM public.profiles WHERE id = _sender FOR UPDATE;
  IF _balance IS NULL OR _balance < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.profiles SET blox_balance = blox_balance - _amount WHERE id = _sender;
  UPDATE public.profiles SET blox_balance = blox_balance + _amount WHERE id = _creator;

  INSERT INTO public.blox_transactions (user_id, amount, kind, reference_id, description)
  VALUES (_sender, -_amount, 'gift_sent', _video::TEXT, 'Gift sent to video creator');
  INSERT INTO public.blox_transactions (user_id, amount, kind, reference_id, description)
  VALUES (_creator, _amount, 'gift_received', _video::TEXT, 'Gift received on video');

  INSERT INTO public.video_comments (video_id, user_id, content, media_type, media_url)
  VALUES (_video, _sender, 'Sent a gift to the creator', 'gift', _amount::TEXT)
  RETURNING id INTO _comment;

  RETURN _comment;
END;
$$;

REVOKE ALL ON FUNCTION public.gift_video_creator(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gift_video_creator(UUID, INTEGER) TO authenticated;
