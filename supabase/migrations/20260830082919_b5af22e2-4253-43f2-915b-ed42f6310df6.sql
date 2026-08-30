CREATE TABLE public.official_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  description text,
  cover_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  venue text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  price_text text,
  organizer_name text NOT NULL DEFAULT '',
  organizer_logo text,
  booking_whatsapp text,
  ticket_url text,
  terms text,
  published boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.official_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_events TO authenticated;
GRANT ALL ON public.official_events TO service_role;

ALTER TABLE public.official_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published official events"
ON public.official_events FOR SELECT
USING (published = true OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create official events"
ON public.official_events FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update official events"
ON public.official_events FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete official events"
ON public.official_events FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER official_events_touch_updated_at
BEFORE UPDATE ON public.official_events
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX official_events_feed_idx
ON public.official_events (published, is_pinned DESC, starts_at);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS default_booking_whatsapp text;