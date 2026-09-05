ALTER TABLE public.events
  ADD COLUMN booking_type text NOT NULL DEFAULT 'instant'
  CHECK (booking_type IN ('instant', 'selection'));

CREATE TABLE public.event_application_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question_text text NOT NULL CHECK (char_length(btrim(question_text)) BETWEEN 1 AND 300),
  question_type text NOT NULL CHECK (question_type IN ('text', 'short_answer', 'multiple_choice')),
  choices text[] NOT NULL DEFAULT '{}',
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (question_type <> 'multiple_choice' OR cardinality(choices) >= 2)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_application_questions TO authenticated;
GRANT ALL ON public.event_application_questions TO service_role;
ALTER TABLE public.event_application_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible event questions are readable"
ON public.event_application_questions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id));
CREATE POLICY "Hosts create event questions"
ON public.event_application_questions FOR INSERT TO authenticated
WITH CHECK (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()));
CREATE POLICY "Hosts update event questions"
ON public.event_application_questions FOR UPDATE TO authenticated
USING (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()))
WITH CHECK (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()));
CREATE POLICY "Hosts delete event questions"
ON public.event_application_questions FOR DELETE TO authenticated
USING (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()));

CREATE TABLE public.event_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'payment_pending', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id),
  CHECK (jsonb_typeof(answers) = 'array')
);
GRANT SELECT, INSERT, DELETE ON public.event_applications TO authenticated;
GRANT UPDATE ON public.event_applications TO authenticated;
GRANT ALL ON public.event_applications TO service_role;
ALTER TABLE public.event_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicants and hosts view applications"
ON public.event_applications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()));
CREATE POLICY "Users submit own applications"
ON public.event_applications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
      AND e.booking_type = 'selection'
      AND e.host_id <> auth.uid()
      AND e.closed_at IS NULL
      AND e.status <> 'cancelled'
  )
);
CREATE POLICY "Hosts update application status"
ON public.event_applications FOR UPDATE TO authenticated
USING (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()))
WITH CHECK (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()));
CREATE POLICY "Applicants cancel pending applications"
ON public.event_applications FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status = 'pending');

CREATE INDEX event_application_questions_event_order_idx
  ON public.event_application_questions(event_id, sort_order);
CREATE INDEX event_applications_user_created_idx
  ON public.event_applications(user_id, created_at DESC);
CREATE INDEX event_applications_event_status_idx
  ON public.event_applications(event_id, status, created_at DESC);

CREATE TRIGGER touch_event_application_questions_updated_at
BEFORE UPDATE ON public.event_application_questions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_event_applications_updated_at
BEFORE UPDATE ON public.event_applications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.respond_event_application(
  _application_id uuid,
  _decision text
)
RETURNS public.event_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  app public.event_applications;
  applicant_gender text;
BEGIN
  IF _decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid application decision';
  END IF;

  SELECT a.* INTO app
  FROM public.event_applications a
  WHERE a.id = _application_id
  FOR UPDATE;

  IF app.id IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF NOT (private.is_event_host(app.event_id, auth.uid()) OR private.is_event_cohost(app.event_id, auth.uid())) THEN
    RAISE EXCEPTION 'Only the event host can decide this application';
  END IF;

  UPDATE public.event_applications
  SET status = _decision, updated_at = now()
  WHERE id = app.id
  RETURNING * INTO app;

  IF _decision = 'accepted' THEN
    SELECT p.gender INTO applicant_gender FROM public.profiles p WHERE p.id = app.user_id;
    INSERT INTO public.event_participants (event_id, user_id, status, gender)
    VALUES (app.event_id, app.user_id, 'approved', applicant_gender)
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET status = 'approved', gender = EXCLUDED.gender, updated_at = now();
  ELSE
    DELETE FROM public.event_participants
    WHERE event_id = app.event_id AND user_id = app.user_id AND status = 'pending';
  END IF;

  RETURN app;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_event_application(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_event_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_event_application(uuid, text) TO service_role;