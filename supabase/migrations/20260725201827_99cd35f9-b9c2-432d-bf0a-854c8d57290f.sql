
CREATE OR REPLACE FUNCTION public.event_participant_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE host uuid;
BEGIN
  SELECT host_id INTO host FROM public.events WHERE id = NEW.event_id;
  IF host IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.user_id <> host THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
    VALUES (host, 'join_request', NEW.user_id, NEW.event_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
      VALUES (NEW.user_id, 'join_approved', host, NEW.event_id);
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
      VALUES (NEW.user_id, 'join_declined', host, NEW.event_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_event_participant_notify_ins ON public.event_participants;
DROP TRIGGER IF EXISTS trg_event_participant_notify_upd ON public.event_participants;

CREATE TRIGGER trg_event_participant_notify_ins
AFTER INSERT ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.event_participant_notify();

CREATE TRIGGER trg_event_participant_notify_upd
AFTER UPDATE OF status ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.event_participant_notify();
