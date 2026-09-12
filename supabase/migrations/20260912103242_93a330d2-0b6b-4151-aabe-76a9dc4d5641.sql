ALTER TABLE public.official_events
  ADD COLUMN IF NOT EXISTS whatsapp_accept_message text,
  ADD COLUMN IF NOT EXISTS whatsapp_reject_message text;

CREATE OR REPLACE FUNCTION public.get_official_event_organiser_review_data(p_event_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token_hash text;
  v_token_valid boolean;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'token required';
  END IF;

  v_token_hash := encode(
    extensions.digest(p_token, 'sha256'),
    'hex'
  );

  SELECT EXISTS (
    SELECT 1
    FROM public.official_event_organiser_tokens
    WHERE event_id = p_event_id
      AND token_hash = v_token_hash
      AND expires_at > now()
  )
  INTO v_token_valid;

  IF NOT v_token_valid THEN
    RAISE EXCEPTION 'invalid or expired organiser link';
  END IF;

  SELECT jsonb_build_object(
    'event',
    (
      SELECT jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'ticket_url', e.ticket_url,
        'pass_price', e.pass_price,
        'price_text', e.price_text,
        'whatsapp_accept_message', e.whatsapp_accept_message,
        'whatsapp_reject_message', e.whatsapp_reject_message
      )
      FROM public.official_events e
      WHERE e.id = p_event_id
    ),

    'questions',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'event_id', q.event_id,
            'question_text', q.question_text,
            'question_type', q.question_type,
            'choices', q.choices,
            'is_required', q.is_required,
            'sort_order', q.sort_order
          )
          ORDER BY q.sort_order ASC
        )
        FROM public.official_event_application_questions q
        WHERE q.event_id = p_event_id
      ),
      '[]'::jsonb
    ),

    'applications',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'event_id', a.event_id,
            'user_id', a.user_id,
            'status', a.status,
            'answers', a.answers,
            'reviewed_by', a.reviewed_by,
            'reviewed_at', a.reviewed_at,
            'rejection_reason', a.rejection_reason,
            'accepted_at', a.accepted_at,
            'payment_deadline_at', a.payment_deadline_at,
            'created_at', a.created_at,
            'updated_at', a.updated_at,

            'applicant_name',
              COALESCE(p.full_name, 'Gathr User'),

            'applicant_phone',
              p.phone,

            'payment_status',
              (
                SELECT o.payment_status
                FROM public.official_orders o
                WHERE o.event_id = a.event_id
                  AND o.user_id = a.user_id
                ORDER BY o.updated_at DESC
                LIMIT 1
              )
          )
          ORDER BY a.created_at DESC
        )
        FROM public.official_event_applications a
        LEFT JOIN public.profiles p
          ON p.id = a.user_id
        WHERE a.event_id = p_event_id
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;