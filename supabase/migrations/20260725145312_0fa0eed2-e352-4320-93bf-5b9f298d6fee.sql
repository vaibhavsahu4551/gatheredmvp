ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.posts ALTER COLUMN caption DROP NOT NULL;
ALTER TABLE public.posts ADD CONSTRAINT posts_caption_or_photo CHECK (
  (caption IS NOT NULL AND length(btrim(caption)) > 0) OR (photo_url IS NOT NULL AND length(photo_url) > 0)
);
CREATE INDEX IF NOT EXISTS posts_event_id_idx ON public.posts(event_id);