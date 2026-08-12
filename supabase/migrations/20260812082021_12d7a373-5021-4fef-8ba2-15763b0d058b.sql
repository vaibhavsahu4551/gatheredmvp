CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(
  id uuid,
  full_name text,
  dob date,
  gender text,
  city text,
  bio text,
  interests text[],
  photos text[],
  onboarding_complete boolean,
  created_at timestamptz,
  updated_at timestamptz,
  pride_opt_in boolean,
  subscription_tier text,
  premium_expires_at timestamptz,
  early_access boolean,
  instagram_handle text,
  spotify_url text,
  x_handle text,
  height_cm integer,
  profession text,
  smoking text,
  drinking text,
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    p.id, p.full_name, p.dob, p.gender, p.city, p.bio, p.interests, p.photos,
    p.onboarding_complete, p.created_at, p.updated_at, p.pride_opt_in,
    p.subscription_tier, p.premium_expires_at, p.early_access,
    p.instagram_handle, p.spotify_url, p.x_handle,
    p.height_cm, p.profession, p.smoking, p.drinking, p.is_verified
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated, service_role;