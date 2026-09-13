-- Communities: unique short tag (2-5 letters/digits) + unique name + description length cap.

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS tag text;

UPDATE public.communities
SET tag = upper(substring(regexp_replace(handle, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 5))
WHERE tag IS NULL;

ALTER TABLE public.communities ALTER COLUMN tag SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communities_tag_format') THEN
    ALTER TABLE public.communities
      ADD CONSTRAINT communities_tag_format CHECK (tag ~ '^[A-Z0-9]{2,5}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communities_description_length') THEN
    ALTER TABLE public.communities
      ADD CONSTRAINT communities_description_length CHECK (description IS NULL OR char_length(description) <= 30);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS communities_tag_unique_idx ON public.communities (upper(tag));
CREATE UNIQUE INDEX IF NOT EXISTS communities_name_unique_idx ON public.communities (lower(name));
