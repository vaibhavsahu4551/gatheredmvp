
-- 1. Pride interests + guidelines acknowledgement
ALTER TABLE public.pride_profiles ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pride_guidelines_at timestamptz;

DROP FUNCTION IF EXISTS public.get_pride_identities(uuid[]);
CREATE OR REPLACE FUNCTION public.get_pride_identities(_pride_ids uuid[])
RETURNS TABLE(pride_id uuid, display_name text, photo_path text, bio text, interests text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.pride_id, p.display_name, p.photo_path, p.bio, p.interests
  FROM public.pride_profiles p
  WHERE p.pride_id = ANY(_pride_ids)
    AND private.has_pride_access(auth.uid())
$$;

-- 2. Venue type + co-host
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_type text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS cohost_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohost_pride_actor_id uuid,
  ADD COLUMN IF NOT EXISTS cohost_status text NOT NULL DEFAULT 'none';

DROP POLICY IF EXISTS "View events (pride-scoped)" ON public.events;
CREATE POLICY "View events (pride-scoped)" ON public.events
FOR SELECT TO authenticated
USING (
  ((is_pride = false) OR (host_id = auth.uid()) OR private.has_pride_access(auth.uid()))
  AND (cohost_status <> 'pending' OR host_id = auth.uid() OR cohost_id = auth.uid())
);

DROP POLICY IF EXISTS "Host updates own event" ON public.events;
CREATE POLICY "Host updates own event" ON public.events
FOR UPDATE TO authenticated
USING (auth.uid() = host_id OR auth.uid() = cohost_id)
WITH CHECK (auth.uid() = host_id OR auth.uid() = cohost_id);

CREATE OR REPLACE FUNCTION private.is_event_cohost(_event uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event AND e.cohost_id = _user AND e.cohost_status = 'accepted')
$$;

DROP POLICY IF EXISTS "Host or self updates participant" ON public.event_participants;
CREATE POLICY "Host or self updates participant" ON public.event_participants
FOR UPDATE TO authenticated
USING (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()) OR user_id = auth.uid())
WITH CHECK (private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Members view participants" ON public.event_participants;
CREATE POLICY "Members view participants" ON public.event_participants
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_event_host(event_id, auth.uid()) OR private.is_event_cohost(event_id, auth.uid()) OR private.is_event_member(event_id, auth.uid()));

-- Search Pride identities without exposing real user ids
CREATE OR REPLACE FUNCTION public.pride_search_identities(_q text)
RETURNS TABLE(pride_id uuid, display_name text, photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.pride_id, p.display_name, p.photo_path
  FROM public.pride_profiles p
  WHERE private.has_pride_access(auth.uid())
    AND p.user_id <> auth.uid()
    AND (_q IS NULL OR _q = '' OR p.display_name ILIKE '%' || _q || '%')
  ORDER BY p.display_name
  LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.pride_set_cohost(_event uuid, _pride_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _target uuid; _ev record;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_pride_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO _ev FROM public.events WHERE id = _event;
  IF _ev IS NULL OR _ev.host_id <> auth.uid() OR _ev.is_pride = false THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT user_id INTO _target FROM public.pride_profiles WHERE pride_id = _pride_id;
  IF _target IS NULL OR _target = auth.uid() THEN RAISE EXCEPTION 'Invalid co-host'; END IF;

  UPDATE public.events
  SET cohost_id = _target, cohost_pride_actor_id = _pride_id, cohost_status = 'pending'
  WHERE id = _event;

  INSERT INTO public.notifications (user_id, kind, target_id, is_pride, data)
  VALUES (_target, 'pride_cohost_invite', _event, true, jsonb_build_object('event_id', _event));
END;
$$;

CREATE OR REPLACE FUNCTION public.pride_respond_cohost(_event uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev record;
BEGIN
  SELECT * INTO _ev FROM public.events WHERE id = _event;
  IF _ev IS NULL OR _ev.cohost_id <> auth.uid() OR _ev.cohost_status <> 'pending' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _accept THEN
    UPDATE public.events SET cohost_status = 'accepted' WHERE id = _event;
  ELSE
    UPDATE public.events SET cohost_status = 'declined', cohost_id = NULL, cohost_pride_actor_id = NULL WHERE id = _event;
  END IF;
  INSERT INTO public.notifications (user_id, kind, target_id, is_pride, data)
  VALUES (_ev.host_id, CASE WHEN _accept THEN 'pride_cohost_accepted' ELSE 'pride_cohost_declined' END, _event, true,
          jsonb_build_object('event_id', _event));
END;
$$;

CREATE OR REPLACE FUNCTION public.pride_my_cohost_invites()
RETURNS TABLE(event_id uuid, title text, starts_at timestamptz, city text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.title, e.starts_at, e.city
  FROM public.events e
  WHERE e.cohost_id = auth.uid() AND e.cohost_status = 'pending'
    AND private.has_pride_access(auth.uid())
  ORDER BY e.starts_at
$$;

REVOKE ALL ON FUNCTION public.pride_search_identities(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pride_set_cohost(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pride_respond_cohost(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pride_my_cohost_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pride_search_identities(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pride_set_cohost(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pride_respond_cohost(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pride_my_cohost_invites() TO authenticated;

-- 3. Trusted contact check-ins (no Pride-identifying data ever stored/returned)
CREATE TABLE IF NOT EXISTS public.event_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  contact_phone text,
  starts_at timestamptz NOT NULL,
  back_by timestamptz NOT NULL,
  area text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
GRANT SELECT, INSERT, DELETE ON public.event_checkins TO authenticated;
GRANT ALL ON public.event_checkins TO service_role;
ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own check-ins" ON public.event_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create own check-ins" ON public.event_checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own check-ins" ON public.event_checkins FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_event_checkin(_event uuid, _phone text, _hours integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ev record; _tok text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO _ev FROM public.events WHERE id = _event;
  IF _ev IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF _ev.host_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.event_participants p WHERE p.event_id = _event AND p.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  _tok := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.event_checkins (event_id, user_id, token, contact_phone, starts_at, back_by, area, expires_at)
  VALUES (_event, auth.uid(), _tok, nullif(trim(_phone), ''), _ev.starts_at,
          _ev.starts_at + make_interval(hours => greatest(1, least(24, coalesce(_hours, 4)))),
          _ev.city, _ev.starts_at + interval '7 days');
  RETURN _tok;
END;
$$;

-- Public lookup: intentionally returns only generic, non-identifying details.
CREATE OR REPLACE FUNCTION public.get_event_checkin(_token text)
RETURNS TABLE(starts_at timestamptz, back_by timestamptz, area text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.starts_at, c.back_by, c.area
  FROM public.event_checkins c
  WHERE c.token = _token AND c.expires_at > now()
$$;

REVOKE ALL ON FUNCTION public.create_event_checkin(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_event_checkin(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_checkin(text) TO anon, authenticated;

-- 4. Pride stories
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS is_pride boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pride_actor_id uuid;

CREATE OR REPLACE FUNCTION public.fill_story_pride_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_pride THEN
    SELECT pride_id INTO NEW.pride_actor_id FROM public.pride_profiles WHERE user_id = NEW.user_id;
    IF NEW.pride_actor_id IS NULL THEN RAISE EXCEPTION 'Pride identity required'; END IF;
  ELSE
    NEW.pride_actor_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fill_story_pride_actor_tr ON public.stories;
CREATE TRIGGER fill_story_pride_actor_tr BEFORE INSERT ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.fill_story_pride_actor();

DROP POLICY IF EXISTS "Active stories are visible to signed-in members" ON public.stories;
CREATE POLICY "Active stories are visible to signed-in members" ON public.stories
FOR SELECT TO authenticated
USING (
  ((expires_at > now()) OR (user_id = auth.uid()))
  AND ((is_pride = false) OR private.has_pride_access(auth.uid()))
);
