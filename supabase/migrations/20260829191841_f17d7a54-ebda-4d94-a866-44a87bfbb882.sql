
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS boost_credits integer NOT NULL DEFAULT 0;

INSERT INTO public.badge_catalog(badge, label, description, icon, priority, active)
VALUES ('founding_member', 'Founding Member', 'Backed Gathr with a yearly Premium plan', 'crown', 1, true)
ON CONFLICT (badge) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, icon = EXCLUDED.icon, active = true;

CREATE OR REPLACE FUNCTION public.apply_premium_purchase(_user uuid, _plan text, _months integer, _bonus_points integer, _boosts integer, _founding boolean)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_expiry timestamptz;
BEGIN
  IF _user IS NULL OR _months IS NULL OR _months < 1 THEN
    RAISE EXCEPTION 'Invalid purchase';
  END IF;

  UPDATE public.profiles
     SET subscription_tier = 'premium',
         premium_expires_at = GREATEST(COALESCE(premium_expires_at, now()), now()) + (_months || ' months')::interval,
         boost_credits = boost_credits + GREATEST(COALESCE(_boosts, 0), 0)
   WHERE id = _user
   RETURNING premium_expires_at INTO new_expiry;

  IF COALESCE(_bonus_points, 0) > 0 THEN
    PERFORM private.add_points(_user, _bonus_points, 'premium_bonus', 'Bonus for ' || _plan || ' Premium plan');
  END IF;

  IF COALESCE(_founding, false) THEN
    INSERT INTO public.user_badges(user_id, badge, reason)
    VALUES (_user, 'founding_member', 'Yearly Premium plan')
    ON CONFLICT (user_id, badge) DO NOTHING;
  END IF;

  RETURN new_expiry;
END $$;

REVOKE ALL ON FUNCTION public.apply_premium_purchase(uuid, text, integer, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_premium_purchase(uuid, text, integer, integer, integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.use_boost_credit(_event uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); ev uuid; bal integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT boost_credits INTO bal FROM public.profiles WHERE id = me;
  IF COALESCE(bal, 0) < 1 THEN RAISE EXCEPTION 'No boost credits left'; END IF;

  IF _event IS NOT NULL THEN
    SELECT id INTO ev FROM public.events WHERE id = _event AND host_id = me;
  ELSE
    SELECT id INTO ev FROM public.events
     WHERE host_id = me AND status IN ('pending','confirmed') AND COALESCE(is_pride, false) = false
     ORDER BY starts_at ASC LIMIT 1;
  END IF;
  IF ev IS NULL THEN RAISE EXCEPTION 'No upcoming event to boost'; END IF;

  UPDATE public.events SET boost_weight = GREATEST(boost_weight, 100) WHERE id = ev;
  UPDATE public.profiles SET boost_credits = boost_credits - 1 WHERE id = me;
  RETURN ev;
END $$;

GRANT EXECUTE ON FUNCTION public.use_boost_credit(uuid) TO authenticated;
