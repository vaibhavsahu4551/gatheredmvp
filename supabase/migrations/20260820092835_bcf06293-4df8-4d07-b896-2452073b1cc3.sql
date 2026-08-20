-- Reason column for early closure
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS close_reason text;

-- Host closes an event early and notifies joined attendees
CREATE OR REPLACE FUNCTION public.close_event_early(_event_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.host_id <> auth.uid() THEN RAISE EXCEPTION 'Only the host can close this event'; END IF;
  IF ev.closed_at IS NOT NULL THEN RETURN; END IF;

  UPDATE public.events
     SET closed_at = now(),
         close_reason = NULLIF(btrim(coalesce(_reason, '')), '')
   WHERE id = _event_id;

  INSERT INTO public.notifications (user_id, kind, actor_id, target_id, data, is_pride)
  SELECT p.user_id,
         'event_closed',
         CASE WHEN ev.is_pride THEN NULL ELSE ev.host_id END,
         ev.id,
         jsonb_build_object('title', ev.title, 'reason', NULLIF(btrim(coalesce(_reason, '')), '')),
         ev.is_pride
    FROM public.event_participants p
   WHERE p.event_id = _event_id
     AND p.status = 'approved'
     AND p.user_id <> ev.host_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_event_early(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_event_early(uuid, text) TO authenticated;

-- Sweep: auto-close past events with zero attendees + warn hosts 24h out with zero attendees
CREATE OR REPLACE FUNCTION public.sweep_empty_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-close events whose time passed with zero approved attendees
  UPDATE public.events e
     SET closed_at = now()
   WHERE e.closed_at IS NULL
     AND e.starts_at < now()
     AND NOT EXISTS (
       SELECT 1 FROM public.event_participants p
        WHERE p.event_id = e.id AND p.status = 'approved' AND p.user_id <> e.host_id
     );

  -- Warn hosts of upcoming (<=24h) events with zero approved attendees, once per event
  INSERT INTO public.notifications (user_id, kind, actor_id, target_id, data, is_pride)
  SELECT e.host_id, 'event_no_attendees', NULL, e.id,
         jsonb_build_object('title', e.title, 'starts_at', e.starts_at),
         e.is_pride
    FROM public.events e
   WHERE e.closed_at IS NULL
     AND e.status IN ('pending','confirmed')
     AND e.starts_at > now()
     AND e.starts_at <= now() + interval '24 hours'
     AND NOT EXISTS (
       SELECT 1 FROM public.event_participants p
        WHERE p.event_id = e.id AND p.status = 'approved' AND p.user_id <> e.host_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n
        WHERE n.user_id = e.host_id AND n.kind = 'event_no_attendees' AND n.target_id = e.id
     );
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_empty_events() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('sweep-empty-events', '15 * * * *', $$SELECT public.sweep_empty_events();$$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-empty-events');