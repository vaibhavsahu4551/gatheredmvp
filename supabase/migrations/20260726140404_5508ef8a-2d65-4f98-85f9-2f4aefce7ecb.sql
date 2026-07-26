
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_pride boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_user_pride_idx ON public.notifications(user_id, is_pride, created_at DESC);

-- Backfill: mark existing join_* notifications tied to pride events
UPDATE public.notifications n
SET is_pride = true
FROM public.events e
WHERE n.target_id = e.id
  AND n.kind IN ('join_request','join_approved','join_declined')
  AND e.is_pride = true
  AND n.is_pride = false;

CREATE OR REPLACE FUNCTION public.event_participant_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE host uuid; is_p boolean;
BEGIN
  SELECT host_id, is_pride INTO host, is_p FROM public.events WHERE id = NEW.event_id;
  IF host IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.user_id <> host THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id, is_pride)
    VALUES (host, 'join_request', NEW.user_id, NEW.event_id, COALESCE(is_p, false));
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id, is_pride)
      VALUES (NEW.user_id, 'join_approved', host, NEW.event_id, COALESCE(is_p, false));
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id, is_pride)
      VALUES (NEW.user_id, 'join_declined', host, NEW.event_id, COALESCE(is_p, false));
    END IF;
  END IF;
  RETURN NEW;
END $function$;
