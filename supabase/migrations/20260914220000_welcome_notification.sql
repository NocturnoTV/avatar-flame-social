-- Sends a one-time, language-aware welcome message the moment onboarding
-- completes (not at raw signup, since the user's real language choice isn't
-- known yet at that point). It's delivered through the existing "Team Spark"
-- virtual thread (messages.$id.tsx's TeamSparkConversation), which is just a
-- read-only view over `notifications` rows with kind = 'system' - no new
-- account or conversation needed.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.send_welcome_notification(_user UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lang TEXT;
  _text TEXT;
BEGIN
  SELECT language INTO _lang FROM public.profiles WHERE id = _user;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _user AND welcomed_at IS NOT NULL) THEN RETURN; END IF;

  _text := CASE _lang
    WHEN 'fr' THEN
      'Bienvenue sur BloxSpark ! 👋' || E'\n\n' ||
      'Nous sommes ravis de t''accueillir dans la communauté. 🎉' || E'\n\n' ||
      'Voici un aperçu de ce que tu peux faire dès maintenant :' || E'\n' ||
      '🎥 Découvrir — des vidéos Roblox en continu, façon feed vertical' || E'\n' ||
      '✨ Sparks — rencontre et discute avec d''autres joueurs' || E'\n' ||
      '👥 Communautés — rejoins des salons autour de tes jeux préférés' || E'\n' ||
      '💰 Blox — la monnaie de BloxSpark, à gagner ou à acheter en boutique' || E'\n' ||
      '🎁 Récompenses — des défis quotidiens pour gagner des Blox gratuitement' || E'\n\n' ||
      'Pour toute question, l''équipe support reste à ta disposition.' || E'\n\n' ||
      'Bonne découverte sur BloxSpark 🚀'
    WHEN 'es' THEN
      '¡Bienvenido a BloxSpark! 👋' || E'\n\n' ||
      'Nos alegra mucho tenerte en la comunidad. 🎉' || E'\n\n' ||
      'Esto es lo que puedes hacer desde ya:' || E'\n' ||
      '🎥 Descubrir — un feed infinito de vídeos de Roblox' || E'\n' ||
      '✨ Sparks — conoce y chatea con otros jugadores' || E'\n' ||
      '👥 Comunidades — únete a salas sobre tus juegos favoritos' || E'\n' ||
      '💰 Blox — la moneda de BloxSpark, gánala gratis o cómprala en la tienda' || E'\n' ||
      '🎁 Recompensas — retos diarios que dan Blox gratis' || E'\n\n' ||
      'Si tienes alguna duda, nuestro equipo de soporte está aquí para ayudarte.' || E'\n\n' ||
      'Disfruta de BloxSpark 🚀'
    WHEN 'pt' THEN
      'Bem-vindo(a) ao BloxSpark! 👋' || E'\n\n' ||
      'Ficamos muito felizes em ter você na comunidade. 🎉' || E'\n\n' ||
      'Veja o que você já pode fazer:' || E'\n' ||
      '🎥 Descobrir — um feed infinito de vídeos de Roblox' || E'\n' ||
      '✨ Sparks — conheça e converse com outros jogadores' || E'\n' ||
      '👥 Comunidades — entre em salas sobre seus jogos favoritos' || E'\n' ||
      '💰 Blox — a moeda do BloxSpark, ganhe de graça ou compre na loja' || E'\n' ||
      '🎁 Recompensas — desafios diários que rendem Blox grátis' || E'\n\n' ||
      'Se tiver alguma dúvida, nossa equipe de suporte está à disposição.' || E'\n\n' ||
      'Aproveite o BloxSpark 🚀'
    WHEN 'de' THEN
      'Willkommen bei BloxSpark! 👋' || E'\n\n' ||
      'Wir freuen uns sehr, dich in der Community begrüßen zu dürfen. 🎉' || E'\n\n' ||
      'Das kannst du ab sofort tun:' || E'\n' ||
      '🎥 Entdecken — ein endloser Feed mit Roblox-Videos' || E'\n' ||
      '✨ Sparks — lerne andere Spieler kennen und chatte mit ihnen' || E'\n' ||
      '👥 Communitys — tritt Räumen rund um deine Lieblingsspiele bei' || E'\n' ||
      '💰 Blox — die Währung von BloxSpark, kostenlos verdienen oder im Shop kaufen' || E'\n' ||
      '🎁 Belohnungen — tägliche Herausforderungen mit kostenlosen Blox' || E'\n\n' ||
      'Bei Fragen ist unser Support-Team für dich da.' || E'\n\n' ||
      'Viel Spaß mit BloxSpark 🚀'
    WHEN 'ko' THEN
      'BloxSpark에 오신 걸 환영해요! 👋' || E'\n\n' ||
      '커뮤니티에 함께하게 되어 정말 기뻐요. 🎉' || E'\n\n' ||
      '지금 바로 할 수 있는 것들을 소개할게요:' || E'\n' ||
      '🎥 디스커버 — 끝없이 이어지는 로블록스 영상 피드' || E'\n' ||
      '✨ Sparks — 다른 플레이어와 만나고 대화하기' || E'\n' ||
      '👥 커뮤니티 — 좋아하는 게임을 중심으로 한 채널에 참여하기' || E'\n' ||
      '💰 Blox — BloxSpark의 재화, 무료로 모으거나 상점에서 구매' || E'\n' ||
      '🎁 리워드 — 매일 도전 과제로 Blox를 무료로 받기' || E'\n\n' ||
      '궁금한 점이 있으면 언제든 고객지원팀에 문의해 주세요.' || E'\n\n' ||
      'BloxSpark에서 즐거운 시간 보내세요 🚀'
    ELSE
      'Welcome to BloxSpark! 👋' || E'\n\n' ||
      'We''re delighted to have you join the community. 🎉' || E'\n\n' ||
      'Here''s a quick overview of what you can do right away:' || E'\n' ||
      '🎥 Discover — an endless feed of Roblox videos' || E'\n' ||
      '✨ Sparks — meet and chat with other players' || E'\n' ||
      '👥 Communities — join rooms built around your favorite games' || E'\n' ||
      '💰 Blox — BloxSpark''s currency, earn it free or buy it in the shop' || E'\n' ||
      '🎁 Rewards — daily challenges that pay out free Blox' || E'\n\n' ||
      'If you have any questions, our support team is here to help.' || E'\n\n' ||
      'Enjoy your time on BloxSpark 🚀'
  END;

  INSERT INTO public.notifications (user_id, kind, body) VALUES (_user, 'system', _text);
  UPDATE public.profiles SET welcomed_at = now() WHERE id = _user;
END;
$$;

REVOKE ALL ON FUNCTION public.send_welcome_notification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_welcome_notification(UUID) TO service_role, authenticated;

-- Fires once, the moment onboarding_completed flips to true (onboarding.tsx's
-- finish() upsert), which is the first point the user's real language choice
-- is known.
CREATE OR REPLACE FUNCTION public.trigger_send_welcome_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_completed = true AND OLD.onboarding_completed IS DISTINCT FROM true THEN
    PERFORM public.send_welcome_notification(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_send_welcome ON public.profiles;
CREATE TRIGGER profiles_send_welcome
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trigger_send_welcome_notification();

-- One-time backfill for every account that had already finished onboarding
-- before this migration. send_welcome_notification()'s own welcomed_at
-- guard means this is safe to re-run.
SELECT public.send_welcome_notification(id)
FROM public.profiles
WHERE onboarding_completed = true AND welcomed_at IS NULL;
