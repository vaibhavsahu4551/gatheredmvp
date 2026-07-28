
-- 1) PROFILES: column-level restriction. Revoke wildcard SELECT and grant only safe columns to authenticated.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id, full_name, dob, gender, city, bio, interests, photos, selfie_url,
  onboarding_complete, created_at, updated_at, pride_opt_in,
  subscription_tier, premium_expires_at, early_access
) ON public.profiles TO authenticated;

-- Own-user full-row access via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.profiles WHERE id = auth.uid(); $$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Admin helpers
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT '')
RETURNS TABLE(id uuid, full_name text, phone text, created_at timestamptz, suspended_until timestamptz, pride_opt_in boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.phone, p.created_at, p.suspended_until, p.pride_opt_in
    FROM public.profiles p
    WHERE (_search = '' OR p.full_name ILIKE '%' || _search || '%')
    ORDER BY p.created_at DESC
    LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_user(_user uuid)
RETURNS TABLE(id uuid, full_name text, bio text, phone text, created_at timestamptz, suspended_until timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.bio, p.phone, p.created_at, p.suspended_until
    FROM public.profiles p WHERE p.id = _user;
END $$;
REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_suspend_user(_user uuid, _until timestamptz, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET suspended_until = _until, suspension_reason = _reason WHERE id = _user;
END $$;
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, timestamptz, text) TO authenticated;

-- 2) app_settings: restrict to authenticated
DROP POLICY IF EXISTS "Everyone reads settings" ON public.app_settings;
CREATE POLICY "Authenticated reads settings" ON public.app_settings
FOR SELECT TO authenticated USING (true);

-- 3) event_participants approved rows only visible to event members
DROP POLICY IF EXISTS "Anyone auth views approved participants" ON public.event_participants;
CREATE POLICY "Members view approved participants" ON public.event_participants
FOR SELECT TO authenticated
USING (status = 'approved' AND public.is_event_member(event_id, auth.uid()));

-- 4) posts / comments / likes: filter blocked users
DROP POLICY IF EXISTS "Authenticated view posts" ON public.posts;
CREATE POLICY "Authenticated view posts" ON public.posts
FOR SELECT TO authenticated
USING (NOT public.is_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Authenticated view comments" ON public.post_comments;
CREATE POLICY "Authenticated view comments" ON public.post_comments
FOR SELECT TO authenticated
USING (NOT public.is_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Authenticated view likes" ON public.post_likes;
CREATE POLICY "Authenticated view likes" ON public.post_likes
FOR SELECT TO authenticated
USING (NOT public.is_blocked(auth.uid(), user_id));

-- 5) SECURITY DEFINER function lockdown: revoke public/anon EXECUTE broadly.
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.selfie_uploaded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_event_confirmation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_participant_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.huddle_request_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_event_pride_actor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_cm_pride_actor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_ep_pride_actor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_ec_pride_actor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_like_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_comment_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_participant_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_premium_flags() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_boost_new_event() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_verified(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_host(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_dm_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.are_huddled(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_pride_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pride_suspended(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_dm_read(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dm_unread() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_pride_identities(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_events_created_last_30d(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_events_joined_last_30d(uuid) FROM PUBLIC, anon;
