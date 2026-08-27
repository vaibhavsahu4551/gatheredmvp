-- 1. mark_dm_read must be able to write the read timestamp
CREATE OR REPLACE FUNCTION public.mark_dm_read(_thread uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.dm_threads
    SET last_read_a = CASE WHEN user_a = auth.uid() THEN now() ELSE last_read_a END,
        last_read_b = CASE WHEN user_b = auth.uid() THEN now() ELSE last_read_b END
    WHERE id = _thread AND (user_a = auth.uid() OR user_b = auth.uid());
END $function$;

-- allow participants to bump thread activity / read markers directly too
DROP POLICY IF EXISTS "Members update thread" ON public.dm_threads;
CREATE POLICY "Members update thread" ON public.dm_threads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- 2. chat group visibility: cover circle chats as well as event chats
DROP POLICY IF EXISTS "Members view group" ON public.chat_groups;
CREATE POLICY "Members view group" ON public.chat_groups
  FOR SELECT TO authenticated
  USING (private.is_group_member(id, auth.uid()));

-- 3. unlock event group chat as soon as a participant is approved
CREATE OR REPLACE FUNCTION public.check_event_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  approved_count int;
  ev record;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;
  SELECT count(*) INTO approved_count FROM public.event_participants
    WHERE event_id = NEW.event_id AND status = 'approved';

  IF approved_count >= 1 THEN
    INSERT INTO public.chat_groups(event_id) VALUES (ev.id) ON CONFLICT DO NOTHING;
  END IF;

  IF ev.status = 'pending' AND approved_count >= ev.min_size THEN
    UPDATE public.events SET status = 'confirmed' WHERE id = ev.id;
  END IF;
  RETURN NEW;
END $function$;

-- backfill chat groups for events that already have approved attendees
INSERT INTO public.chat_groups(event_id)
SELECT DISTINCT p.event_id FROM public.event_participants p
WHERE p.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.event_id = p.event_id);