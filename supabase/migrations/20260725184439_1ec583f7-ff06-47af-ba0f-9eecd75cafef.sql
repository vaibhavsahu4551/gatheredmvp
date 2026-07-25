
DROP POLICY IF EXISTS "Verified users can create events" ON public.events;
CREATE POLICY "Users create own events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Verified users request join" ON public.event_participants;
CREATE POLICY "Users request join" ON public.event_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending'::participant_status);

DROP POLICY IF EXISTS "Users comment" ON public.post_comments;
CREATE POLICY "Users comment" ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
