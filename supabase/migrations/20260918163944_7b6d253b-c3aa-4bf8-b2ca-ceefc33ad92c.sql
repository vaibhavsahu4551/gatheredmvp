ALTER TABLE public.official_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'upi',
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text;

ALTER TABLE public.official_orders ALTER COLUMN utr DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.official_orders
    ADD CONSTRAINT official_orders_payment_method_chk
    CHECK (payment_method IN ('upi','razorpay'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.official_orders
    ADD CONSTRAINT official_orders_utr_required_for_upi
    CHECK (payment_method <> 'upi' OR (utr IS NOT NULL AND btrim(utr) <> ''));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS official_orders_rzp_payment_uidx
  ON public.official_orders (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS official_orders_rzp_order_uidx
  ON public.official_orders (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_verified_razorpay_official_order(
  p_user_id uuid,
  p_event_id uuid,
  p_pass_id uuid,
  p_quantity integer,
  p_paid_amount numeric,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_coupon_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text
)
RETURNS public.official_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.official_orders;
  v_pass public.official_event_passes;
  v_coupon public.official_event_coupons;
  v_subtotal numeric(10,2);
  v_final numeric(10,2);
  v_usage integer;
  v_user_usage integer;
  v_rzp_enabled boolean;
BEGIN
  IF p_user_id IS NULL OR p_event_id IS NULL OR p_pass_id IS NULL THEN
    RAISE EXCEPTION 'Missing order details';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  -- Idempotency: return the existing ticket for this payment/order.
  SELECT * INTO v_order
  FROM public.official_orders
  WHERE razorpay_payment_id = p_razorpay_payment_id
     OR razorpay_order_id = p_razorpay_order_id
  LIMIT 1;

  IF v_order.id IS NOT NULL THEN
    RETURN v_order;
  END IF;

  SELECT razorpay_enabled INTO v_rzp_enabled
  FROM public.official_events WHERE id = p_event_id;

  IF v_rzp_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Online payments are not enabled for this event';
  END IF;

  SELECT * INTO v_pass
  FROM public.official_event_passes
  WHERE id = p_pass_id AND event_id = p_event_id AND active = true
  FOR UPDATE;

  IF v_pass.id IS NULL THEN
    RAISE EXCEPTION 'Pass is no longer available';
  END IF;

  IF v_pass.total_quantity > 0
     AND v_pass.sold_quantity + p_quantity > v_pass.total_quantity THEN
    RAISE EXCEPTION 'Not enough passes remaining';
  END IF;

  v_subtotal := round(v_pass.price * p_quantity, 2);
  v_final := v_subtotal;

  IF p_coupon_id IS NOT NULL THEN
    SELECT * INTO v_coupon
    FROM public.official_event_coupons
    WHERE id = p_coupon_id AND event_id = p_event_id
    FOR UPDATE;

    IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'Invalid coupon'; END IF;
    IF NOT v_coupon.active THEN RAISE EXCEPTION 'Coupon is inactive'; END IF;
    IF v_coupon.starts_at IS NOT NULL AND now() < v_coupon.starts_at THEN
      RAISE EXCEPTION 'Coupon is not active yet';
    END IF;
    IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN
      RAISE EXCEPTION 'Coupon has expired';
    END IF;

    SELECT COUNT(*) INTO v_usage
    FROM public.official_event_coupon_uses WHERE coupon_id = v_coupon.id;
    IF v_coupon.usage_limit IS NOT NULL AND v_usage >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'Coupon usage limit reached';
    END IF;

    SELECT COUNT(*) INTO v_user_usage
    FROM public.official_event_coupon_uses
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
    IF v_user_usage >= v_coupon.per_user_limit THEN
      RAISE EXCEPTION 'You have already used this coupon';
    END IF;

    IF v_coupon.discount_type = 'PERCENTAGE' THEN
      v_final := round(v_subtotal - least(round(v_subtotal * v_coupon.discount_value / 100, 2), v_subtotal), 2);
    ELSE
      v_final := round(v_subtotal - least(v_coupon.discount_value, v_subtotal), 2);
    END IF;
  END IF;

  IF round(p_paid_amount, 2) <> v_final THEN
    RAISE EXCEPTION 'Paid amount does not match the order amount';
  END IF;

  INSERT INTO public.official_orders (
    user_id, event_id, pass_id, pass_name, quantity, amount,
    utr, screenshot_path, customer_name, customer_phone, customer_email,
    payment_status, ticket_status, payment_method,
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    verified_at
  ) VALUES (
    p_user_id, p_event_id, p_pass_id, v_pass.name, p_quantity, v_final,
    NULL, NULL, btrim(p_customer_name), btrim(p_customer_phone), NULLIF(btrim(coalesce(p_customer_email,'')), ''),
    'APPROVED', 'ACTIVE', 'razorpay',
    p_razorpay_order_id, p_razorpay_payment_id, p_razorpay_signature,
    now()
  )
  RETURNING * INTO v_order;

  IF p_coupon_id IS NOT NULL THEN
    INSERT INTO public.official_event_coupon_uses (
      coupon_id, event_id, user_id, order_id, discount_amount
    ) VALUES (
      p_coupon_id, p_event_id, p_user_id, v_order.id, round(v_subtotal - v_final, 2)
    );
  END IF;

  RETURN v_order;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_verified_razorpay_official_order(uuid,uuid,uuid,integer,numeric,text,text,text,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_verified_razorpay_official_order(uuid,uuid,uuid,integer,numeric,text,text,text,uuid,text,text,text) TO service_role;