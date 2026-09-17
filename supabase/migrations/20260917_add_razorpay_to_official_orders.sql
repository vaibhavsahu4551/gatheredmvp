ALTER TABLE public.official_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'upi'
    CHECK (payment_method IN ('upi', 'razorpay')),
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text;

CREATE UNIQUE INDEX IF NOT EXISTS official_orders_razorpay_order_id_idx
ON public.official_orders (razorpay_order_id)
WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS official_orders_razorpay_payment_id_idx
ON public.official_orders (razorpay_payment_id)
WHERE razorpay_payment_id IS NOT NULL;
