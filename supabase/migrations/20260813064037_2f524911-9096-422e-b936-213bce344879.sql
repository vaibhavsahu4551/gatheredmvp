ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cover_url text;

CREATE OR REPLACE FUNCTION public.event_is_closed(_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT e.closed_at IS NOT NULL OR e.starts_at < now() OR e.status = 'cancelled'
       FROM public.events e WHERE e.id = _event),
    false)
$$;

GRANT EXECUTE ON FUNCTION public.event_is_closed(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.block_closed_event_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.event_is_closed(NEW.event_id) THEN
    RAISE EXCEPTION 'This event is closed — new joins are not allowed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_closed_event_join ON public.event_participants;
CREATE TRIGGER trg_block_closed_event_join
BEFORE INSERT ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.block_closed_event_join();

CREATE OR REPLACE FUNCTION public.block_closed_event_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.event_is_closed(NEW.event_id) THEN
    RAISE EXCEPTION 'This event is closed — the discussion is read-only.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_closed_event_comment ON public.event_comments;
CREATE TRIGGER trg_block_closed_event_comment
BEFORE INSERT ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public.block_closed_event_comment();