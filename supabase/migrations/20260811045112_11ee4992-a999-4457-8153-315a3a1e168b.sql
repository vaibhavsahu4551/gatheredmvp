-- 1. Remove old ID/selfie-based bits
DROP TRIGGER IF EXISTS selfie_uploaded ON public.profiles;
DROP TRIGGER IF EXISTS trg_selfie_uploaded ON public.profiles;
DROP TRIGGER IF EXISTS profiles_selfie_uploaded ON public.profiles;
DROP FUNCTION IF EXISTS public.selfie_uploaded() CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS selfie_url;

-- 2. Extend verification_status for the new live-selfie flow
ALTER TABLE public.verification_status
  ADD COLUMN IF NOT EXISTS selfie_path text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- 3. Reset everyone so all members go through the new flow
UPDATE public.verification_status
   SET status = 'unverified', rejection_reason = NULL, notes = NULL,
       selfie_path = NULL, submitted_at = NULL, priority = false, updated_at = now();

-- 4. Member submits a live selfie
CREATE OR REPLACE FUNCTION public.submit_verification(_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _tier text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _path IS NULL OR _path = '' THEN RAISE EXCEPTION 'Missing selfie'; END IF;
  IF split_part(_path, '/', 1) <> _uid::text THEN RAISE EXCEPTION 'Invalid selfie path'; END IF;

  SELECT subscription_tier INTO _tier FROM public.profiles WHERE id = _uid;

  INSERT INTO public.verification_status (user_id, status, selfie_path, submitted_at, priority, rejection_reason, updated_at)
  VALUES (_uid, 'pending', _path, now(), COALESCE(_tier,'free') = 'premium', NULL, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'pending', selfie_path = EXCLUDED.selfie_path, submitted_at = now(),
        priority = EXCLUDED.priority, rejection_reason = NULL, updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.submit_verification(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_verification(text) TO authenticated;

-- 5. Rebuilt admin queue
DROP FUNCTION IF EXISTS public.admin_list_verification(text);
CREATE OR REPLACE FUNCTION public.admin_list_verification(_status text DEFAULT 'pending')
RETURNS TABLE(user_id uuid, full_name text, status text, priority boolean,
              rejection_reason text, selfie_path text, photos text[],
              submitted_at timestamptz, updated_at timestamptz, is_premium boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT v.user_id, pr.full_name,
           CASE WHEN v.status::text = 'unverified' AND v.rejection_reason IS NOT NULL
                THEN 'rejected' ELSE v.status::text END,
           v.priority, v.rejection_reason, v.selfie_path, pr.photos,
           v.submitted_at, v.updated_at,
           COALESCE(pr.subscription_tier, 'free') = 'premium'
    FROM public.verification_status v
    LEFT JOIN public.profiles pr ON pr.id = v.user_id
    WHERE (COALESCE(_status,'') = '' OR _status = 'all'
           OR (_status = 'rejected' AND v.status::text = 'unverified' AND v.rejection_reason IS NOT NULL)
           OR (_status = 'unverified' AND v.status::text = 'unverified' AND v.rejection_reason IS NULL)
           OR (_status NOT IN ('rejected','unverified') AND v.status::text = _status))
    ORDER BY (COALESCE(pr.subscription_tier,'free') = 'premium') DESC,
             v.priority DESC, v.submitted_at ASC NULLS LAST, v.updated_at ASC
    LIMIT 500;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_verification(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_verification(text) TO authenticated;

-- 6. Approve / reject + notify
CREATE OR REPLACE FUNCTION public.admin_set_verification(_user uuid, _status text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status NOT IN ('verified','rejected','unverified','pending') THEN RAISE EXCEPTION 'Unknown status'; END IF;

  IF _status = 'rejected' THEN
    IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
    UPDATE public.verification_status
       SET status = 'unverified', rejection_reason = btrim(_reason), updated_at = now()
     WHERE user_id = _user;
    INSERT INTO public.notifications (user_id, kind, data, is_pride)
    VALUES (_user, 'verification_rejected', jsonb_build_object('reason', btrim(_reason)), false);
  ELSE
    UPDATE public.verification_status
       SET status = _status::verification_state, rejection_reason = NULL, updated_at = now()
     WHERE user_id = _user;
    IF _status = 'verified' THEN
      INSERT INTO public.notifications (user_id, kind, data, is_pride)
      VALUES (_user, 'verification_approved', '{}'::jsonb, false);
    END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.admin_set_verification(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_verification(uuid, text, text) TO authenticated;

-- 7. Admins can view submitted live selfies
DROP POLICY IF EXISTS "Admins view verification selfies" ON storage.objects;
CREATE POLICY "Admins view verification selfies" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'selfies' AND private.has_role(auth.uid(), 'admin'));
