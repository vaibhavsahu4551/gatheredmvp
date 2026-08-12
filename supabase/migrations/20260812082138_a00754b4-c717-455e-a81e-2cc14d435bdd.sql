GRANT SELECT (
  id,
  full_name,
  dob,
  gender,
  city,
  bio,
  interests,
  photos,
  onboarding_complete,
  created_at,
  updated_at,
  pride_opt_in,
  subscription_tier,
  premium_expires_at,
  early_access,
  instagram_handle,
  spotify_url,
  x_handle,
  height_cm,
  profession,
  smoking,
  drinking,
  is_verified
) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;