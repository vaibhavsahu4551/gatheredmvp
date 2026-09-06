-- ============================================================
-- GATHR OFFICIAL EVENTS - SELECTION BASED BOOKING
-- ============================================================

-- 1. Add booking mode to official events
ALTER TABLE public.official_events
ADD COLUMN IF NOT EXISTS booking_type text
NOT NULL DEFAULT 'instant'
CHECK (booking_type IN ('instant', 'selection'));

-- 2. Optional organiser information
ALTER TABLE public.official_events
ADD COLUMN IF NOT EXISTS organiser_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.official_events
ADD COLUMN IF NOT EXISTS selection_payment_deadline_minutes integer
NOT NULL DEFAULT 30
CHECK (selection_payment_deadline_minutes > 0);


-- ============================================================
-- 3. APPLICATION QUESTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.official_event_application_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id uuid NOT NULL
        REFERENCES public.official_events(id)
        ON DELETE CASCADE,

    question_text text NOT NULL
        CHECK (char_length(btrim(question_text)) BETWEEN 1 AND 300),

    question_type text NOT NULL
        CHECK (
            question_type IN (
                'short_answer',
                'long_answer',
                'multiple_choice',
                'yes_no'
            )
        ),

    choices text[] NOT NULL DEFAULT '{}',

    is_required boolean NOT NULL DEFAULT true,

    sort_order integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    CHECK (
        question_type <> 'multiple_choice'
        OR cardinality(choices) >= 2
    )
);

CREATE INDEX IF NOT EXISTS
official_event_application_questions_event_idx
ON public.official_event_application_questions(event_id);


-- ============================================================
-- 4. APPLICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.official_event_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id uuid NOT NULL
        REFERENCES public.official_events(id)
        ON DELETE CASCADE,

    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    answers jsonb NOT NULL DEFAULT '[]'::jsonb,

    status text NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'accepted',
                'rejected',
                'expired'
            )
        ),

    rejection_reason text,

    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    reviewed_at timestamptz,

    payment_deadline timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(event_id, user_id),

    CHECK (jsonb_typeof(answers) = 'array')
);

CREATE INDEX IF NOT EXISTS
official_event_applications_event_status_idx
ON public.official_event_applications(
    event_id,
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
official_event_applications_user_idx
ON public.official_event_applications(
    user_id,
    created_at DESC
);


-- ============================================================
-- 5. ORGANISER ACCESS TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.official_event_organiser_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id uuid NOT NULL
        REFERENCES public.official_events(id)
        ON DELETE CASCADE,

    organiser_user_id uuid
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    token_hash text NOT NULL UNIQUE,

    expires_at timestamptz,

    revoked_at timestamptz,

    created_by uuid
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
official_event_organiser_access_event_idx
ON public.official_event_organiser_access(event_id);


-- ============================================================
-- 6. LINK ORDER TO APPLICATION
-- ============================================================

ALTER TABLE public.official_orders
ADD COLUMN IF NOT EXISTS application_id uuid
REFERENCES public.official_event_applications(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS
official_orders_application_idx
ON public.official_orders(application_id);


-- ============================================================
-- 7. RLS
-- ============================================================

ALTER TABLE public.official_event_application_questions
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.official_event_applications
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.official_event_organiser_access
ENABLE ROW LEVEL SECURITY;


-- Questions: users can read questions for published official events
CREATE POLICY "Users can read official event application questions"
ON public.official_event_application_questions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.official_events e
        WHERE e.id = event_id
        AND e.published = true
    )
);


-- Admin can manage questions
CREATE POLICY "Admins manage official event questions"
ON public.official_event_application_questions
FOR ALL
TO authenticated
USING (
    private.has_role(auth.uid(), 'admin')
)
WITH CHECK (
    private.has_role(auth.uid(), 'admin')
);


-- Applicant can see own application
CREATE POLICY "Users can view own official applications"
ON public.official_event_applications
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin')
);


-- User can submit own application
CREATE POLICY "Users can submit official applications"
ON public.official_event_applications
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.official_events e
        WHERE e.id = event_id
        AND e.published = true
        AND e.booking_type = 'selection'
    )
);


-- User can cancel only pending application
CREATE POLICY "Users can delete pending official applications"
ON public.official_event_applications
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
    AND status = 'pending'
);


-- Admin can manage applications
CREATE POLICY "Admins manage official applications"
ON public.official_event_applications
FOR ALL
TO authenticated
USING (
    private.has_role(auth.uid(), 'admin')
)
WITH CHECK (
    private.has_role(auth.uid(), 'admin')
);


-- ============================================================
-- 8. ORGANISER REVIEW FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.organiser_review_official_application(
    _application_id uuid,
    _decision text,
    _rejection_reason text DEFAULT NULL
)
RETURNS public.official_event_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    app public.official_event_applications;
BEGIN

    IF _decision NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Invalid decision';
    END IF;

    SELECT *
    INTO app
    FROM public.official_event_applications
    WHERE id = _application_id
    FOR UPDATE;

    IF app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    IF NOT (
        private.has_role(auth.uid(), 'admin')
        OR EXISTS (
            SELECT 1
            FROM public.official_events e
            WHERE e.id = app.event_id
            AND e.organiser_user_id = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'Not authorized to review this application';
    END IF;

    UPDATE public.official_event_applications
    SET
        status = _decision,
        rejection_reason =
            CASE
                WHEN _decision = 'rejected'
                THEN NULLIF(btrim(_rejection_reason), '')
                ELSE NULL
            END,
        reviewed_by = auth.uid(),
        reviewed_at = now(),

        payment_deadline =
            CASE
                WHEN _decision = 'accepted'
                THEN now() + (
                    SELECT make_interval(
                        mins => selection_payment_deadline_minutes
                    )
                    FROM public.official_events
                    WHERE id = app.event_id
                )
                ELSE NULL
            END,

        updated_at = now()

    WHERE id = app.id
    RETURNING * INTO app;

    RETURN app;
END;
$$;

REVOKE ALL ON FUNCTION
public.organiser_review_official_application(
    uuid,
    text,
    text
)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
public.organiser_review_official_application(
    uuid,
    text,
    text
)
TO authenticated;


-- ============================================================
-- 9. USER APPLICATION STATUS FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_official_application(
    _event_id uuid
)
RETURNS public.official_event_applications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT *
    FROM public.official_event_applications
    WHERE event_id = _event_id
    AND user_id = auth.uid()
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION
public.get_my_official_application(uuid)
TO authenticated;
