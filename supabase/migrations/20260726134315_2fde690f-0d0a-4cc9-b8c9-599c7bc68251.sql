
REVOKE EXECUTE ON FUNCTION public.get_pride_identities(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pride_suspended(uuid)       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_pride_identities(uuid[]) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.pride_suspended(uuid)        TO authenticated;
