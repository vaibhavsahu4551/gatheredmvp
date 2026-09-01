CREATE TABLE public.official_event_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.official_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  total_quantity integer NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  sold_quantity integer NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.official_event_passes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_event_passes TO authenticated;
GRANT ALL ON public.official_event_passes TO service_role;

ALTER TABLE public.official_event_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view passes of published events"
ON public.official_event_passes FOR SELECT
USING (
  private.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.official_events e WHERE e.id = event_id AND e.published = true)
);

CREATE POLICY "Admins can create passes"
ON public.official_event_passes FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update passes"
ON public.official_event_passes FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete passes"
ON public.official_event_passes FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER official_event_passes_touch_updated_at
BEFORE UPDATE ON public.official_event_passes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX official_event_passes_event_idx
ON public.official_event_passes (event_id, sort_order);

CREATE TABLE public.official_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE DEFAULT ('GTHR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.official_events(id) ON DELETE CASCADE,
  pass_id uuid REFERENCES public.official_event_passes(id) ON DELETE SET NULL,
  pass_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount numeric NOT NULL CHECK (amount >= 0),
  utr text NOT NULL,
  screenshot_path text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','APPROVED','REJECTED')),
  ticket_status text NOT NULL DEFAULT 'PENDING' CHECK (ticket_status IN ('PENDING','ACTIVE','USED','CANCELLED')),
  admin_notes text,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.official_orders TO authenticated;
GRANT UPDATE, DELETE ON public.official_orders TO authenticated;
GRANT ALL ON public.official_orders TO service_role;

ALTER TABLE public.official_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
ON public.official_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can submit their own pending orders"
ON public.official_orders FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND payment_status = 'PENDING'
  AND ticket_status = 'PENDING'
  AND verified_at IS NULL
  AND verified_by IS NULL
);

CREATE POLICY "Admins can update orders"
ON public.official_orders FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete orders"
ON public.official_orders FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER official_orders_touch_updated_at
BEFORE UPDATE ON public.official_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX official_orders_user_idx ON public.official_orders (user_id, created_at DESC);
CREATE INDEX official_orders_status_idx ON public.official_orders (payment_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.official_order_sync_sold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'APPROVED' AND OLD.payment_status IS DISTINCT FROM 'APPROVED' AND NEW.pass_id IS NOT NULL THEN
    UPDATE public.official_event_passes
      SET sold_quantity = sold_quantity + NEW.quantity
      WHERE id = NEW.pass_id;
  ELSIF OLD.payment_status = 'APPROVED' AND NEW.payment_status IS DISTINCT FROM 'APPROVED' AND NEW.pass_id IS NOT NULL THEN
    UPDATE public.official_event_passes
      SET sold_quantity = GREATEST(0, sold_quantity - NEW.quantity)
      WHERE id = NEW.pass_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER official_orders_sync_sold
AFTER UPDATE ON public.official_orders
FOR EACH ROW EXECUTE FUNCTION public.official_order_sync_sold();

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS upi_payee_name text;