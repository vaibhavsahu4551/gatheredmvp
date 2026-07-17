ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firebase_uid text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_firebase_uid_key
  ON public.profiles(firebase_uid)
  WHERE firebase_uid IS NOT NULL;