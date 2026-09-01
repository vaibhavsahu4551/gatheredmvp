ALTER TABLE public.official_events
  ADD COLUMN IF NOT EXISTS pass_price numeric,
  ADD COLUMN IF NOT EXISTS pass_quantity integer,
  ADD COLUMN IF NOT EXISTS pass_info text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by_type text NOT NULL DEFAULT 'admin';

ALTER TABLE public.official_events
  ADD CONSTRAINT official_events_created_by_type_chk CHECK (created_by_type IN ('user','admin'));

CREATE INDEX IF NOT EXISTS official_events_feed_idx
  ON public.official_events (published, is_pinned DESC, is_featured DESC, starts_at);