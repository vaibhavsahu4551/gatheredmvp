ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_profile_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
     SET is_verified = (NEW.status::text = 'verified')
   WHERE id = NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS verification_sync_profile ON public.verification_status;
CREATE TRIGGER verification_sync_profile
AFTER INSERT OR UPDATE OF status ON public.verification_status
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_verified();

UPDATE public.profiles p
   SET is_verified = COALESCE((SELECT v.status::text = 'verified' FROM public.verification_status v WHERE v.user_id = p.id), false);