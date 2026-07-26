
-- Pride section: private, opt-in-only
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pride_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_pride boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS events_is_pride_starts_at_idx ON public.events (is_pride, starts_at);

-- Security-definer accessor to avoid recursive RLS on profiles.
CREATE OR REPLACE FUNCTION public.has_pride_access(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _user AND pride_opt_in = true);
$$;

-- Rebuild SELECT policy on events: pride events only visible to opted-in users (host always sees own).
DROP POLICY IF EXISTS "Authenticated can view events" ON public.events;
CREATE POLICY "View events (pride-scoped)" ON public.events
  FOR SELECT TO authenticated
  USING (
    is_pride = false
    OR host_id = auth.uid()
    OR public.has_pride_access(auth.uid())
  );

-- Prevent non-opted-in users from creating pride events.
DROP POLICY IF EXISTS "Users create own events" ON public.events;
CREATE POLICY "Users create own events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND (is_pride = false OR public.has_pride_access(auth.uid()))
  );
