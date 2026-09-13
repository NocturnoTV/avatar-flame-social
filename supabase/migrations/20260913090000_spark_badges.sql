-- Configurable "Sparks profile" badges shown on the swipe card
-- (e.g. 🎮 Gamer, 🎙️ Mic, 🏆 Competitive, 😄 Friendly...).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spark_badges TEXT[] NOT NULL DEFAULT '{}'::text[];
