ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS smoking text,
  ADD COLUMN IF NOT EXISTS drinking text;

GRANT SELECT (height_cm, profession, smoking, drinking) ON public.profiles TO authenticated;
GRANT SELECT (height_cm, profession, smoking, drinking) ON public.profiles TO anon;