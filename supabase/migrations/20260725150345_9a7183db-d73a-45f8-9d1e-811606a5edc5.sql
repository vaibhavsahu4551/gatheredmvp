
CREATE TABLE public.event_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_comments_event_created_idx ON public.event_comments(event_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_comments TO authenticated;
GRANT ALL ON public.event_comments TO service_role;

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read event comments"
ON public.event_comments FOR SELECT TO authenticated
USING (public.is_event_member(event_id, auth.uid()));

CREATE POLICY "Members can post event comments"
ON public.event_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_event_member(event_id, auth.uid()));

CREATE POLICY "Authors can delete their comments"
ON public.event_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;
