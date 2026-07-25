
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS exact_location text;

-- BLOCKS
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks read" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "own blocks insert" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "own blocks delete" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

-- REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user','event')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','fake_profile','inappropriate','safety','other')),
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports read" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "own reports insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Prevent joining events involving a block relationship with the host
CREATE OR REPLACE FUNCTION public.block_participant_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h uuid;
BEGIN
  SELECT host_id INTO h FROM public.events WHERE id = NEW.event_id;
  IF h IS NOT NULL AND public.is_blocked(h, NEW.user_id) THEN
    RAISE EXCEPTION 'Blocked between host and user';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS block_participant_insert ON public.event_participants;
CREATE TRIGGER block_participant_insert BEFORE INSERT ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.block_participant_insert();
