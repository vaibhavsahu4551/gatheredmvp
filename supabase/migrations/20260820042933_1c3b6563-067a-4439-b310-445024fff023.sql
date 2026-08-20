CREATE POLICY "Approved attendees visible on visible events"
ON public.event_participants FOR SELECT TO authenticated
USING (
  status = 'approved'::participant_status
  AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_participants.event_id)
);