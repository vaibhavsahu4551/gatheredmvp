
-- 1. Private schema for RLS helpers (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Recreate helper functions in private schema (SECURITY DEFINER, same bodies)
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_event_host(_event uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.events WHERE id = _event AND host_id = _user);
$$;

CREATE OR REPLACE FUNCTION private.is_event_member(_event uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.event_participants WHERE event_id = _event AND user_id = _user AND status = 'approved')
      OR private.is_event_host(_event, _user);
$$;

CREATE OR REPLACE FUNCTION private.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.chat_groups g WHERE g.id = _group AND private.is_event_member(g.event_id, _user)
  );
$$;

CREATE OR REPLACE FUNCTION private.is_dm_member(_thread uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dm_threads WHERE id = _thread AND (user_a = _user OR user_b = _user));
$$;

CREATE OR REPLACE FUNCTION private.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

CREATE OR REPLACE FUNCTION private.are_huddled(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.huddle_requests
    WHERE status = 'accepted'
      AND ((from_id = _a AND to_id = _b) OR (from_id = _b AND to_id = _a))
  );
$$;

CREATE OR REPLACE FUNCTION private.has_pride_access(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _user AND pride_opt_in = true);
$$;

CREATE OR REPLACE FUNCTION private.is_verified(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.verification_status WHERE user_id = _user AND status = 'verified');
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- 3. Recreate trigger/RPC functions in public that referenced the old helpers, pointing to private schema
CREATE OR REPLACE FUNCTION public.block_participant_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h uuid;
BEGIN
  SELECT host_id INTO h FROM public.events WHERE id = NEW.event_id;
  IF h IS NOT NULL AND private.is_blocked(h, NEW.user_id) THEN
    RAISE EXCEPTION 'Blocked between host and user';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_user(_user uuid)
RETURNS TABLE(id uuid, full_name text, bio text, phone text, created_at timestamp with time zone, suspended_until timestamp with time zone)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.bio, p.phone, p.created_at, p.suspended_until
    FROM public.profiles p WHERE p.id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT ''::text)
RETURNS TABLE(id uuid, full_name text, phone text, created_at timestamp with time zone, suspended_until timestamp with time zone, pride_opt_in boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.phone, p.created_at, p.suspended_until, p.pride_opt_in
    FROM public.profiles p
    WHERE (_search = '' OR p.full_name ILIKE '%' || _search || '%')
    ORDER BY p.created_at DESC
    LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.admin_suspend_user(_user uuid, _until timestamp with time zone, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET suspended_until = _until, suspension_reason = _reason WHERE id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.get_pride_identities(_pride_ids uuid[])
RETURNS TABLE(pride_id uuid, display_name text, photo_path text, bio text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.pride_id, pp.display_name, pp.photo_path, pp.bio
  FROM public.pride_profiles pp
  WHERE pp.pride_id = ANY(_pride_ids)
    AND private.has_pride_access(auth.uid());
$$;

-- 4. Drop and recreate policies referencing helpers to use private schema
DROP POLICY IF EXISTS "Members view participants" ON public.event_participants;
CREATE POLICY "Members view participants" ON public.event_participants FOR SELECT
  USING ((user_id = auth.uid()) OR private.is_event_host(event_id, auth.uid()) OR private.is_event_member(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host or self updates participant" ON public.event_participants;
CREATE POLICY "Host or self updates participant" ON public.event_participants FOR UPDATE
  USING (private.is_event_host(event_id, auth.uid()) OR (user_id = auth.uid()))
  WITH CHECK (private.is_event_host(event_id, auth.uid()) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Self or host deletes participant" ON public.event_participants;
CREATE POLICY "Self or host deletes participant" ON public.event_participants FOR DELETE
  USING ((user_id = auth.uid()) OR private.is_event_host(event_id, auth.uid()));

DROP POLICY IF EXISTS "Members view approved participants" ON public.event_participants;
CREATE POLICY "Members view approved participants" ON public.event_participants FOR SELECT
  USING ((status = 'approved'::participant_status) AND private.is_event_member(event_id, auth.uid()));

DROP POLICY IF EXISTS "Members view group" ON public.chat_groups;
CREATE POLICY "Members view group" ON public.chat_groups FOR SELECT
  USING (private.is_event_member(event_id, auth.uid()));

DROP POLICY IF EXISTS "Members read messages" ON public.chat_messages;
CREATE POLICY "Members read messages" ON public.chat_messages FOR SELECT
  USING (private.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members send messages" ON public.chat_messages;
CREATE POLICY "Members send messages" ON public.chat_messages FOR INSERT
  WITH CHECK ((user_id = auth.uid()) AND private.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Admins view chat messages" ON public.chat_messages;
CREATE POLICY "Admins view chat messages" ON public.chat_messages FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Members can read event comments" ON public.event_comments;
CREATE POLICY "Members can read event comments" ON public.event_comments FOR SELECT
  USING (private.is_event_member(event_id, auth.uid()));

DROP POLICY IF EXISTS "Members can post event comments" ON public.event_comments;
CREATE POLICY "Members can post event comments" ON public.event_comments FOR INSERT
  WITH CHECK ((auth.uid() = user_id) AND private.is_event_member(event_id, auth.uid()));

DROP POLICY IF EXISTS "Huddled users create thread" ON public.dm_threads;
CREATE POLICY "Huddled users create thread" ON public.dm_threads FOR INSERT
  WITH CHECK (((auth.uid() = user_a) OR (auth.uid() = user_b)) AND private.are_huddled(user_a, user_b));

DROP POLICY IF EXISTS "Members read dm" ON public.dm_messages;
CREATE POLICY "Members read dm" ON public.dm_messages FOR SELECT
  USING (private.is_dm_member(thread_id, auth.uid()));

DROP POLICY IF EXISTS "Members send dm" ON public.dm_messages;
CREATE POLICY "Members send dm" ON public.dm_messages FOR INSERT
  WITH CHECK ((auth.uid() = sender_id) AND private.is_dm_member(thread_id, auth.uid()));

DROP POLICY IF EXISTS "Admins view dm messages" ON public.dm_messages;
CREATE POLICY "Admins view dm messages" ON public.dm_messages FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "View events (pride-scoped)" ON public.events;
CREATE POLICY "View events (pride-scoped)" ON public.events FOR SELECT
  USING ((is_pride = false) OR (host_id = auth.uid()) OR private.has_pride_access(auth.uid()));

DROP POLICY IF EXISTS "Users create own events" ON public.events;
CREATE POLICY "Users create own events" ON public.events FOR INSERT
  WITH CHECK ((auth.uid() = host_id) AND ((is_pride = false) OR private.has_pride_access(auth.uid())));

DROP POLICY IF EXISTS "Admins view events" ON public.events;
CREATE POLICY "Admins view events" ON public.events FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete events" ON public.events;
CREATE POLICY "Admins delete events" ON public.events FOR DELETE
  USING (private.has_role(auth.uid(), 'admin'::app_role) AND (is_pride = false));

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
CREATE POLICY "Admins manage reports" ON public.reports FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;
CREATE POLICY "Admins update settings" ON public.app_settings FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage banners" ON public.home_banners;
CREATE POLICY "Admins manage banners" ON public.home_banners FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view posts" ON public.posts;
CREATE POLICY "Admins view posts" ON public.posts FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete posts" ON public.posts;
CREATE POLICY "Admins delete posts" ON public.posts FOR DELETE
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated view posts" ON public.posts;
CREATE POLICY "Authenticated view posts" ON public.posts FOR SELECT
  USING (NOT private.is_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Authenticated view comments" ON public.post_comments;
CREATE POLICY "Authenticated view comments" ON public.post_comments FOR SELECT
  USING (NOT private.is_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Authenticated view likes" ON public.post_likes;
CREATE POLICY "Authenticated view likes" ON public.post_likes FOR SELECT
  USING (NOT private.is_blocked(auth.uid(), user_id));

-- 5. Drop old public helper functions now that nothing references them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_event_host(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_event_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_dm_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_blocked(uuid, uuid);
DROP FUNCTION IF EXISTS public.are_huddled(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_pride_access(uuid);
DROP FUNCTION IF EXISTS public.is_verified(uuid);
