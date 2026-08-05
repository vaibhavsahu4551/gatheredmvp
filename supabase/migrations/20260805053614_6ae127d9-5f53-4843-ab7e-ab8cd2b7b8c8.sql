DROP FUNCTION IF EXISTS public.get_my_profile();
CREATE FUNCTION public.get_my_profile()
RETURNS TABLE(id uuid, full_name text, dob date, gender text, city text, bio text, interests text[], photos text[], selfie_url text, onboarding_complete boolean, created_at timestamp with time zone, updated_at timestamp with time zone, pride_opt_in boolean, subscription_tier text, premium_expires_at timestamp with time zone, early_access boolean, instagram_handle text, spotify_url text, x_handle text, height_cm integer, profession text, smoking text, drinking text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.full_name, p.dob, p.gender, p.city, p.bio, p.interests, p.photos,
    p.selfie_url, p.onboarding_complete, p.created_at, p.updated_at, p.pride_opt_in,
    p.subscription_tier, p.premium_expires_at, p.early_access,
    p.instagram_handle, p.spotify_url, p.x_handle,
    p.height_cm, p.profession, p.smoking, p.drinking
  FROM public.profiles p
  WHERE p.id = auth.uid();
$function$;