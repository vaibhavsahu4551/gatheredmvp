DROP FUNCTION IF EXISTS public.admin_list_users(text);

CREATE FUNCTION public.admin_list_users(_search text DEFAULT ''::text)
 RETURNS TABLE(id uuid, full_name text, phone text, created_at timestamp with time zone, suspended_until timestamp with time zone, pride_opt_in boolean, has_photo boolean, onboarding_complete boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      p.phone,
      p.created_at,
      p.suspended_until,
      p.pride_opt_in,
      coalesce(array_length(p.photos, 1), 0) > 0 AS has_photo,
      p.onboarding_complete
    FROM public.profiles p
    WHERE (
      _search = ''
      OR p.full_name ILIKE '%' || _search || '%'
      OR coalesce(p.phone, '') ILIKE '%' || _search || '%'
    )
    ORDER BY p.created_at DESC
    LIMIT 500;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text) TO authenticated, service_role;