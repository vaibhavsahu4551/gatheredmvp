
-- Convert RPCs to SECURITY INVOKER; existing RLS on the underlying tables already scopes access.
ALTER FUNCTION public.get_my_profile() SECURITY INVOKER;
ALTER FUNCTION public.get_dm_unread() SECURITY INVOKER;
ALTER FUNCTION public.mark_dm_read(uuid) SECURITY INVOKER;
ALTER FUNCTION public.count_events_created_last_30d(uuid) SECURITY INVOKER;
ALTER FUNCTION public.count_events_joined_last_30d(uuid) SECURITY INVOKER;
ALTER FUNCTION public.pride_suspended(uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_get_user(uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_list_users(text) SECURITY INVOKER;
ALTER FUNCTION public.admin_suspend_user(uuid, timestamptz, text) SECURITY INVOKER;

-- Allow any pride-opted user to read pride_profiles so get_pride_identities works as INVOKER.
DROP POLICY IF EXISTS "Pride members can view pride profiles" ON public.pride_profiles;
CREATE POLICY "Pride members can view pride profiles" ON public.pride_profiles FOR SELECT
  USING (private.has_pride_access(auth.uid()));

ALTER FUNCTION public.get_pride_identities(uuid[]) SECURITY INVOKER;
