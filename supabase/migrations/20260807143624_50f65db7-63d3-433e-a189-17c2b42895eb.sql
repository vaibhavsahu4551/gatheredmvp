-- ============ profiles: points + referral ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS referral_awarded_at timestamptz;

CREATE OR REPLACE FUNCTION private.gen_referral_code()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
$$;

UPDATE public.profiles SET referral_code = private.gen_referral_code() WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles(referred_by);

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      BEGIN
        NEW.referral_code := private.gen_referral_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = NEW.referral_code);
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON public.profiles;
CREATE TRIGGER profiles_set_referral_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

-- ============ points_transactions ============
CREATE TABLE IF NOT EXISTS public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount integer NOT NULL,
  reason text,
  ref_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_transactions TO authenticated;
GRANT ALL ON public.points_transactions TO service_role;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx read" ON public.points_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS points_tx_user_idx ON public.points_transactions(user_id, created_at DESC);

-- ============ badges ============
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges readable" ON public.user_badges FOR SELECT TO authenticated USING (true);

-- ============ rewards config ============
CREATE TABLE IF NOT EXISTS public.rewards_config (
  id integer PRIMARY KEY DEFAULT 1,
  referral_points integer NOT NULL DEFAULT 100,
  welcome_points integer NOT NULL DEFAULT 25,
  cost_trial_days integer NOT NULL DEFAULT 300,
  trial_days integer NOT NULL DEFAULT 7,
  cost_boost integer NOT NULL DEFAULT 150,
  cost_badge integer NOT NULL DEFAULT 200,
  badge_name text NOT NULL DEFAULT 'Supporter',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rewards_config_singleton CHECK (id = 1)
);
INSERT INTO public.rewards_config (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.rewards_config TO authenticated;
GRANT ALL ON public.rewards_config TO service_role;
ALTER TABLE public.rewards_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards config readable" ON public.rewards_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "rewards config admin write" ON public.rewards_config FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- ============ suggestion dismissals ============
CREATE TABLE IF NOT EXISTS public.suggestion_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dismissed_id)
);
GRANT SELECT, INSERT, DELETE ON public.suggestion_dismissals TO authenticated;
GRANT ALL ON public.suggestion_dismissals TO service_role;
ALTER TABLE public.suggestion_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dismissals read" ON public.suggestion_dismissals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own dismissals write" ON public.suggestion_dismissals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own dismissals delete" ON public.suggestion_dismissals FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ points helpers ============
CREATE OR REPLACE FUNCTION private.add_points(_user uuid, _amount integer, _kind text, _reason text, _ref uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.profiles SET points = GREATEST(0, points + _amount) WHERE id = _user;
  INSERT INTO public.points_transactions(user_id, kind, amount, reason, ref_user_id)
  VALUES (_user, _kind, _amount, _reason, _ref);
END $$;

-- Referral reward on onboarding completion
CREATE OR REPLACE FUNCTION public.award_referral_on_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cfg record;
BEGIN
  IF NEW.onboarding_complete AND NOT COALESCE(OLD.onboarding_complete, false)
     AND NEW.referred_by IS NOT NULL AND NEW.referral_awarded_at IS NULL THEN
    SELECT * INTO cfg FROM public.rewards_config WHERE id = 1;
    IF cfg.referral_points > 0 THEN
      PERFORM private.add_points(NEW.referred_by, cfg.referral_points, 'referral', 'Referral bonus', NEW.id);
    END IF;
    IF cfg.welcome_points > 0 THEN
      UPDATE public.profiles SET points = points + cfg.welcome_points WHERE id = NEW.id;
      INSERT INTO public.points_transactions(user_id, kind, amount, reason, ref_user_id)
      VALUES (NEW.id, 'welcome', cfg.welcome_points, 'Welcome bonus', NEW.referred_by);
      NEW.points := COALESCE(NEW.points, 0) + cfg.welcome_points;
    END IF;
    NEW.referral_awarded_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_award_referral ON public.profiles;
CREATE TRIGGER profiles_award_referral BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.award_referral_on_onboarding();

-- ============ user-facing RPCs ============
CREATE OR REPLACE FUNCTION public.get_my_rewards()
RETURNS TABLE(points integer, referral_code text, referred_by uuid, referral_count integer)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT p.points, p.referral_code, p.referred_by,
    (SELECT count(*)::int FROM public.profiles r WHERE r.referred_by = p.id AND r.onboarding_complete)
  FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.claim_referral(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ref uuid; me uuid := auth.uid();
BEGIN
  IF me IS NULL OR _code IS NULL OR _code = '' THEN RETURN false; END IF;
  SELECT id INTO ref FROM public.profiles WHERE upper(referral_code) = upper(_code);
  IF ref IS NULL OR ref = me THEN RETURN false; END IF;
  UPDATE public.profiles SET referred_by = ref
    WHERE id = me AND referred_by IS NULL AND COALESCE(onboarding_complete, false) = false;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_reward(_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cfg record; me uuid := auth.uid(); bal integer; cost integer; ev uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO cfg FROM public.rewards_config WHERE id = 1;
  SELECT points INTO bal FROM public.profiles WHERE id = me;
  cost := CASE _kind WHEN 'trial' THEN cfg.cost_trial_days WHEN 'boost' THEN cfg.cost_boost WHEN 'badge' THEN cfg.cost_badge ELSE NULL END;
  IF cost IS NULL THEN RAISE EXCEPTION 'Unknown reward'; END IF;
  IF COALESCE(bal, 0) < cost THEN RAISE EXCEPTION 'Not enough points'; END IF;

  IF _kind = 'trial' THEN
    UPDATE public.profiles
      SET subscription_tier = 'premium',
          premium_expires_at = GREATEST(COALESCE(premium_expires_at, now()), now()) + (cfg.trial_days || ' days')::interval
      WHERE id = me;
  ELSIF _kind = 'boost' THEN
    SELECT id INTO ev FROM public.events
      WHERE host_id = me AND status IN ('pending','confirmed') AND COALESCE(is_pride, false) = false
      ORDER BY starts_at ASC LIMIT 1;
    IF ev IS NULL THEN RAISE EXCEPTION 'No upcoming event to boost'; END IF;
    UPDATE public.events SET boost_weight = GREATEST(boost_weight, 100) WHERE id = ev;
  ELSIF _kind = 'badge' THEN
    INSERT INTO public.user_badges(user_id, badge, reason) VALUES (me, cfg.badge_name, 'Redeemed with points')
      ON CONFLICT (user_id, badge) DO NOTHING;
  END IF;

  PERFORM private.add_points(me, -cost, 'redeem_' || _kind, 'Redeemed ' || _kind);
  RETURN _kind;
END $$;

-- ============ admin RPCs ============
CREATE OR REPLACE FUNCTION public.admin_adjust_points(_user uuid, _amount integer, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  PERFORM private.add_points(_user, _amount, 'admin_adjust', COALESCE(_reason, 'Admin adjustment'));
END $$;

CREATE OR REPLACE FUNCTION public.admin_grant_badge(_user uuid, _badge text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.user_badges(user_id, badge, reason) VALUES (_user, _badge, COALESCE(_reason, 'Granted by admin'))
    ON CONFLICT (user_id, badge) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_rewards_config(
  _referral_points integer, _welcome_points integer, _cost_trial_days integer,
  _trial_days integer, _cost_boost integer, _cost_badge integer, _badge_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.rewards_config SET
    referral_points = GREATEST(0, _referral_points),
    welcome_points = GREATEST(0, _welcome_points),
    cost_trial_days = GREATEST(1, _cost_trial_days),
    trial_days = GREATEST(1, _trial_days),
    cost_boost = GREATEST(1, _cost_boost),
    cost_badge = GREATEST(1, _cost_badge),
    badge_name = COALESCE(NULLIF(_badge_name, ''), 'Supporter'),
    updated_at = now()
  WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.admin_top_referrers(_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, full_name text, referrals integer, points integer)
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name,
      (SELECT count(*)::int FROM public.profiles r WHERE r.referred_by = p.id AND r.onboarding_complete),
      p.points
    FROM public.profiles p
    WHERE EXISTS (SELECT 1 FROM public.profiles r WHERE r.referred_by = p.id AND r.onboarding_complete)
    ORDER BY 3 DESC, p.points DESC
    LIMIT COALESCE(_limit, 20);
END $$;

CREATE OR REPLACE FUNCTION public.admin_points_stats()
RETURNS TABLE(issued_this_month integer, spent_this_month integer, total_balance integer)
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT
      COALESCE((SELECT sum(amount)::int FROM public.points_transactions WHERE amount > 0 AND created_at >= date_trunc('month', now())), 0),
      COALESCE((SELECT -sum(amount)::int FROM public.points_transactions WHERE amount < 0 AND created_at >= date_trunc('month', now())), 0),
      COALESCE((SELECT sum(points)::int FROM public.profiles), 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_points_tx(_user uuid DEFAULT NULL, _kind text DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE(id uuid, user_id uuid, full_name text, kind text, amount integer, reason text, created_at timestamptz)
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT t.id, t.user_id, p.full_name, t.kind, t.amount, t.reason, t.created_at
    FROM public.points_transactions t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE (_user IS NULL OR t.user_id = _user)
      AND (_kind IS NULL OR _kind = '' OR t.kind = _kind)
    ORDER BY t.created_at DESC
    LIMIT COALESCE(_limit, 100);
END $$;