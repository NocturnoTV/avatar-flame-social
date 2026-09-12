CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT,
  url TEXT,
  tone TEXT NOT NULL DEFAULT 'from-blue-500 to-cyan-400',
  position INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_public_read" ON public.news FOR SELECT TO anon, authenticated USING (published OR public.is_staff(auth.uid()));
CREATE POLICY "news_staff_insert" ON public.news FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "news_staff_update" ON public.news FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "news_staff_delete" ON public.news FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER news_touch BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.news (title, subtitle, body, url, tone, position) VALUES (
  'RDC 2026 : tout ce que Roblox a annoncé',
  'Les grandes nouveautés de la Roblox Developers Conference 2026',
  E'La Roblox Developers Conference 2026 a mis l''accent sur trois axes : la création assistée, l''économie des créateurs et une plateforme plus sociale.\n\nCréation assistée : de nouveaux outils de génération d''objets, de textures et de scripts permettent de prototyper une expérience complète en quelques minutes, directement dans Studio.\n\nÉconomie : la part reversée aux créateurs augmente, les paiements en monnaie réelle sont étendus à davantage de pays et les objets payants gagnent de nouveaux formats.\n\nPlateforme : rendu plus réaliste, avatars plus expressifs, meilleures performances sur mobile et des espaces sociaux pensés pour retrouver ses amis entre deux parties.\n\nBloxspark n''est ni affilié ni approuvé par Roblox Corporation ; cet article est un résumé rédigé par l''équipe.',
  'https://blog.roblox.com/',
  'from-fuchsia-500 to-pink-400',
  0
);