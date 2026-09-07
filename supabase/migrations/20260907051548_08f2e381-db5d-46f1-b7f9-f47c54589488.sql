ALTER TABLE public.official_events ADD COLUMN IF NOT EXISTS ticket_bg_url text;

ALTER TABLE public.official_event_organiser_tokens
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS pin text,
  ADD COLUMN IF NOT EXISTS label text;

CREATE INDEX IF NOT EXISTS idx_org_tokens_event_purpose
  ON public.official_event_organiser_tokens (event_id, purpose);

-- Generate (and replace) a check-in link for one event.
CREATE OR REPLACE FUNCTION public.generate_official_event_checkin_link(
  p_event_id uuid,
  p_pin text DEFAULT NULL,
  p_days integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_expires_at timestamptz;
  v_base_url text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.official_events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'official event not found';
  END IF;

  UPDATE public.official_event_organiser_tokens
     SET revoked_at = now()
   WHERE event_id = p_event_id
     AND purpose = 'checkin'
     AND revoked_at IS NULL;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + make_interval(days => GREATEST(1, COALESCE(p_days, 90)));

  INSERT INTO public.official_event_organiser_tokens (
    event_id, token_hash, expires_at, created_by, purpose, pin
  ) VALUES (
    p_event_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires_at,
    auth.uid(),
    'checkin',
    NULLIF(btrim(COALESCE(p_pin, '')), '')
  );

  v_base_url := current_setting('app.settings.app_url', true);
  IF v_base_url IS NULL OR v_base_url = '' THEN
    v_base_url := 'https://gathrmeet.in';
  END IF;

  RETURN jsonb_build_object(
    'token', v_token,
    'url', v_base_url || '/checkin/' || v_token,
    'expires_at', v_expires_at,
    'has_pin', NULLIF(btrim(COALESCE(p_pin, '')), '') IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_official_event_checkin_links(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.official_event_organiser_tokens
     SET revoked_at = now()
   WHERE event_id = p_event_id AND purpose = 'checkin' AND revoked_at IS NULL;
END;
$$;

-- internal: resolve a checkin token to its event id
CREATE OR REPLACE FUNCTION private.checkin_token_event(p_token text, p_pin text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.official_event_organiser_tokens%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
    FROM public.official_event_organiser_tokens
   WHERE purpose = 'checkin'
     AND token_hash = encode(digest(p_token, 'sha256'), 'hex')
     AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.pin IS NOT NULL AND v_row.pin <> btrim(COALESCE(p_pin, '')) THEN
    RETURN NULL;
  END IF;

  RETURN v_row.event_id;
END;
$$;

-- Minimal event context for the scanner page.
CREATE OR REPLACE FUNCTION public.checkin_context(p_token text, p_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event uuid;
  v_needs_pin boolean;
  v_res jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.official_event_organiser_tokens
     WHERE purpose = 'checkin'
       AND token_hash = encode(digest(COALESCE(p_token,''), 'sha256'), 'hex')
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
       AND pin IS NOT NULL
  ) INTO v_needs_pin;

  v_event := private.checkin_token_event(p_token, p_pin);
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'needs_pin', COALESCE(v_needs_pin,false));
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'event_id', e.id,
    'title', e.title,
    'venue', e.venue,
    'city', e.city,
    'starts_at', e.starts_at
  ) INTO v_res
  FROM public.official_events e WHERE e.id = v_event;

  RETURN COALESCE(v_res, jsonb_build_object('ok', false));
END;
$$;

-- Look up a ticket by order code, scoped to the token's event.
CREATE OR REPLACE FUNCTION public.checkin_lookup_ticket(
  p_token text,
  p_order_code text,
  p_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event uuid;
  o public.official_orders%ROWTYPE;
BEGIN
  v_event := private.checkin_token_event(p_token, p_pin);
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('state', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO o FROM public.official_orders
   WHERE order_code = upper(btrim(COALESCE(p_order_code, '')))
     AND event_id = v_event
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'INVALID');
  END IF;

  RETURN jsonb_build_object(
    'state', CASE
      WHEN o.payment_status <> 'APPROVED' THEN 'INVALID'
      WHEN o.ticket_status = 'USED' THEN 'USED'
      WHEN o.ticket_status = 'ACTIVE' THEN 'VALID'
      ELSE 'INVALID' END,
    'order_id', o.id,
    'order_code', o.order_code,
    'pass_name', o.pass_name,
    'quantity', o.quantity,
    'customer_name', o.customer_name,
    'ticket_status', o.ticket_status,
    'payment_status', o.payment_status
  );
END;
$$;

-- Mark a ticket used, scoped to the token's event.
CREATE OR REPLACE FUNCTION public.checkin_mark_used(
  p_token text,
  p_order_code text,
  p_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event uuid;
  o public.official_orders%ROWTYPE;
BEGIN
  v_event := private.checkin_token_event(p_token, p_pin);
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('state', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO o FROM public.official_orders
   WHERE order_code = upper(btrim(COALESCE(p_order_code, '')))
     AND event_id = v_event
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'INVALID');
  END IF;

  IF o.payment_status <> 'APPROVED' THEN
    RETURN jsonb_build_object('state', 'INVALID');
  END IF;

  IF o.ticket_status = 'USED' THEN
    RETURN jsonb_build_object('state', 'USED', 'order_code', o.order_code,
      'customer_name', o.customer_name, 'pass_name', o.pass_name, 'quantity', o.quantity);
  END IF;

  IF o.ticket_status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('state', 'INVALID');
  END IF;

  UPDATE public.official_orders
     SET ticket_status = 'USED', updated_at = now()
   WHERE id = o.id;

  RETURN jsonb_build_object('state', 'CHECKED_IN', 'order_code', o.order_code,
    'customer_name', o.customer_name, 'pass_name', o.pass_name, 'quantity', o.quantity);
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_context(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkin_lookup_ticket(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkin_mark_used(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_context(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_lookup_ticket(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_mark_used(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_official_event_checkin_link(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_official_event_checkin_links(uuid) TO authenticated;