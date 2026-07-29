DROP FUNCTION IF EXISTS public.get_my_profile();

CREATE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id uuid,
  full_name text,
  dob date,
  gender text,
  city text,
  bio text,
  interests text[],
  photos text[],
  selfie_url text,
  onboarding_complete boolean,
  created_at timestamptz,
  updated_at timestamptz,
  pride_opt_in boolean,
  subscription_tier text,
  premium_expires_at timestamptz,
  early_access boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.dob,
    p.gender,
    p.city,
    p.bio,
    p.interests,
    p.photos,
    p.selfie_url,
    p.onboarding_complete,
    p.created_at,
    p.updated_at,
    p.pride_opt_in,
    p.subscription_tier,
    p.premium_expires_at,
    p.early_access
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT ''::text)
RETURNS TABLE(id uuid, full_name text, phone text, created_at timestamptz, suspended_until timestamptz, pride_opt_in boolean)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      NULL::text AS phone,
      p.created_at,
      NULL::timestamptz AS suspended_until,
      p.pride_opt_in
    FROM public.profiles p
    WHERE (_search = '' OR p.full_name ILIKE '%' || _search || '%')
    ORDER BY p.created_at DESC
    LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user(_user uuid)
RETURNS TABLE(id uuid, full_name text, bio text, phone text, created_at timestamptz, suspended_until timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      p.bio,
      NULL::text AS phone,
      p.created_at,
      NULL::timestamptz AS suspended_until
    FROM public.profiles p
    WHERE p.id = _user;
END;
$$;