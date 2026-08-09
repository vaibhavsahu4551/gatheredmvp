-- ============ Flagged content ============
CREATE TABLE IF NOT EXISTS public.content_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'other',
  is_pride boolean NOT NULL DEFAULT false,
  image_path text,
  confidence numeric,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_flags TO authenticated;
GRANT ALL ON public.content_flags TO service_role;
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read content flags" ON public.content_flags;
CREATE POLICY "Admins read content flags" ON public.content_flags
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

ALTER TABLE public.verification_status
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ============ Icebreaker admin ============
CREATE OR REPLACE FUNCTION public.admin_list_icebreaker_prompts()
RETURNS TABLE(id uuid, body text, active boolean, created_at timestamptz, uses integer, last_used date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.body, p.active, p.created_at,
      (SELECT count(*)::int FROM public.daily_icebreakers d WHERE d.prompt_id = p.id),
      (SELECT max(d.day) FROM public.daily_icebreakers d WHERE d.prompt_id = p.id)
    FROM public.icebreaker_prompts p
    ORDER BY p.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_icebreaker_prompt(_id uuid, _body text, _active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE out_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _body IS NULL OR btrim(_body) = '' THEN RAISE EXCEPTION 'Prompt text is required'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.icebreaker_prompts(body, active) VALUES (btrim(_body), COALESCE(_active, true)) RETURNING id INTO out_id;
  ELSE
    UPDATE public.icebreaker_prompts SET body = btrim(_body), active = COALESCE(_active, true) WHERE id = _id RETURNING id INTO out_id;
  END IF;
  RETURN out_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_icebreaker_prompt(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.daily_icebreakers WHERE prompt_id = _id) THEN
    UPDATE public.icebreaker_prompts SET active = false WHERE id = _id;
  ELSE
    DELETE FROM public.icebreaker_prompts WHERE id = _id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_today_icebreaker(_prompt uuid)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.daily_icebreakers(day, prompt_id) VALUES (d, _prompt)
    ON CONFLICT (day) DO UPDATE SET prompt_id = EXCLUDED.prompt_id;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.admin_icebreaker_history(_limit integer DEFAULT 30)
RETURNS TABLE(day date, prompt_id uuid, body text, responses integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT di.day, di.prompt_id, p.body,
      (SELECT count(*)::int FROM public.posts po WHERE po.kind = 'icebreaker' AND po.icebreaker_day = di.day)
    FROM public.daily_icebreakers di
    JOIN public.icebreaker_prompts p ON p.id = di.prompt_id
    ORDER BY di.day DESC
    LIMIT COALESCE(_limit, 30);
END $$;

CREATE OR REPLACE FUNCTION public.admin_icebreaker_responses(_day date DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE(id uuid, user_id uuid, full_name text, caption text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := COALESCE(_day, (now() AT TIME ZONE 'utc')::date);
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT po.id, po.user_id, pr.full_name, po.caption, po.created_at
    FROM public.posts po LEFT JOIN public.profiles pr ON pr.id = po.user_id
    WHERE po.kind = 'icebreaker' AND po.icebreaker_day = d
    ORDER BY po.created_at DESC LIMIT COALESCE(_limit, 20);
END $$;

-- ============ Weekly challenge admin ============
CREATE OR REPLACE FUNCTION public.admin_list_challenges()
RETURNS TABLE(id uuid, title text, description text, goal_type text, goal_target integer,
              reward_kind text, reward_amount integer, badge_name text, active boolean,
              created_at timestamptz, times_used integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT c.id, c.title, c.description, c.goal_type, c.goal_target, c.reward_kind, c.reward_amount,
           c.badge_name, c.active, c.created_at,
           (SELECT count(*)::int FROM public.weekly_challenge_assignments a WHERE a.challenge_id = c.id)
    FROM public.weekly_challenges c ORDER BY c.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_challenge(
  _id uuid, _title text, _description text, _goal_type text, _goal_target integer,
  _reward_kind text, _reward_amount integer, _badge_name text, _active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE out_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _title IS NULL OR btrim(_title) = '' THEN RAISE EXCEPTION 'Title is required'; END IF;
  IF _goal_type NOT IN ('join_event','host_event','linkup','post') THEN RAISE EXCEPTION 'Unknown goal type'; END IF;
  IF _reward_kind NOT IN ('badge','boost','trial') THEN RAISE EXCEPTION 'Unknown reward type'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.weekly_challenges(title, description, goal_type, goal_target, reward_kind, reward_amount, badge_name, active)
    VALUES (btrim(_title), _description, _goal_type, GREATEST(COALESCE(_goal_target,1),1), _reward_kind,
            GREATEST(COALESCE(_reward_amount,1),1), NULLIF(_badge_name,''), COALESCE(_active,true))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.weekly_challenges SET
      title = btrim(_title), description = _description, goal_type = _goal_type,
      goal_target = GREATEST(COALESCE(_goal_target,1),1), reward_kind = _reward_kind,
      reward_amount = GREATEST(COALESCE(_reward_amount,1),1), badge_name = NULLIF(_badge_name,''),
      active = COALESCE(_active,true)
    WHERE id = _id RETURNING id INTO out_id;
  END IF;
  RETURN out_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_challenge(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.weekly_challenge_assignments WHERE challenge_id = _id) THEN
    UPDATE public.weekly_challenges SET active = false WHERE id = _id;
  ELSE
    DELETE FROM public.weekly_challenges WHERE id = _id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_week_challenge(_id uuid)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws date := (date_trunc('week', now() AT TIME ZONE 'utc'))::date;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.weekly_challenge_assignments(week_start, challenge_id) VALUES (ws, _id)
    ON CONFLICT (week_start) DO UPDATE SET challenge_id = EXCLUDED.challenge_id;
  RETURN ws;
END $$;

CREATE OR REPLACE FUNCTION public.admin_challenge_stats()
RETURNS TABLE(week_start date, challenge_id uuid, title text, completions integer,
              badge_count integer, boost_count integer, trial_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ws date := (date_trunc('week', now() AT TIME ZONE 'utc'))::date;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT ws, a.challenge_id, c.title,
      (SELECT count(*)::int FROM public.challenge_completions cc WHERE cc.week_start = ws),
      (SELECT count(*)::int FROM public.challenge_completions cc WHERE cc.week_start = ws AND cc.reward_kind = 'badge'),
      (SELECT count(*)::int FROM public.challenge_completions cc WHERE cc.week_start = ws AND cc.reward_kind = 'boost'),
      (SELECT count(*)::int FROM public.challenge_completions cc WHERE cc.week_start = ws AND cc.reward_kind = 'trial')
    FROM public.weekly_challenge_assignments a
    JOIN public.weekly_challenges c ON c.id = a.challenge_id
    WHERE a.week_start = ws;
END $$;

-- ============ Posts moderation ============
CREATE OR REPLACE FUNCTION public.admin_list_posts(_search text DEFAULT '', _limit integer DEFAULT 100)
RETURNS TABLE(id uuid, user_id uuid, full_name text, caption text, photo_url text, city text,
              kind text, created_at timestamptz, likes integer, comments integer, reports integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT p.id, p.user_id, pr.full_name, p.caption, p.photo_url, p.city, p.kind, p.created_at,
      (SELECT count(*)::int FROM public.post_likes l WHERE l.post_id = p.id),
      (SELECT count(*)::int FROM public.post_comments c WHERE c.post_id = p.id),
      (SELECT count(*)::int FROM public.reports r WHERE r.target_type = 'post' AND r.target_id = p.id)
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    WHERE (COALESCE(_search,'') = ''
           OR p.caption ILIKE '%' || _search || '%'
           OR pr.full_name ILIKE '%' || _search || '%')
    ORDER BY p.created_at DESC
    LIMIT COALESCE(_limit, 100);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_post(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.post_likes WHERE post_id = _id;
  DELETE FROM public.post_comments WHERE post_id = _id;
  DELETE FROM public.posts WHERE id = _id;
END $$;

-- ============ Verification queue ============
CREATE OR REPLACE FUNCTION public.admin_list_verification(_status text DEFAULT 'pending')
RETURNS TABLE(user_id uuid, full_name text, status text, priority boolean, notes text,
              rejection_reason text, selfie_url text, photos text[], updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT v.user_id, pr.full_name, v.status::text, v.priority, v.notes, v.rejection_reason,
           pr.selfie_url, pr.photos, v.updated_at
    FROM public.verification_status v
    LEFT JOIN public.profiles pr ON pr.id = v.user_id
    WHERE (COALESCE(_status,'') = '' OR _status = 'all' OR v.status::text = _status)
    ORDER BY v.priority DESC, v.updated_at ASC
    LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_verification(_user uuid, _status text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status NOT IN ('unverified','pending','verified') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.verification_status
     SET status = _status::verification_state,
         rejection_reason = CASE WHEN _status = 'unverified' THEN _reason ELSE NULL END,
         updated_at = now()
   WHERE user_id = _user;
END $$;

-- ============ Revenue ============
CREATE OR REPLACE FUNCTION public.admin_revenue_stats()
RETURNS TABLE(active_premium integer, mrr numeric, new_this_month integer, cancelled_this_month integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ap integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT count(*)::int INTO ap FROM public.profiles
    WHERE subscription_tier = 'premium' AND (premium_expires_at IS NULL OR premium_expires_at > now());
  RETURN QUERY SELECT ap, (ap * 199)::numeric,
    (SELECT count(*)::int FROM public.subscriptions WHERE created_at >= date_trunc('month', now())),
    (SELECT count(*)::int FROM public.subscriptions WHERE cancelled_at >= date_trunc('month', now()));
END $$;

CREATE OR REPLACE FUNCTION public.admin_subscriber_trend(_days integer DEFAULT 90)
RETURNS TABLE(day date, subscribers integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT g::date,
      (SELECT count(*)::int FROM public.subscriptions s
        WHERE s.created_at <= (g + interval '1 day')
          AND (s.cancelled_at IS NULL OR s.cancelled_at > g))
    FROM generate_series(now()::date - (COALESCE(_days,90) - 1), now()::date, interval '1 day') g;
END $$;

-- ============ Flagged content admin ============
CREATE OR REPLACE FUNCTION public.admin_list_flags(_status text DEFAULT 'pending')
RETURNS TABLE(id uuid, user_id uuid, full_name text, source text, is_pride boolean,
              image_path text, confidence numeric, reason text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT f.id, f.user_id,
           CASE WHEN f.is_pride THEN NULL ELSE pr.full_name END,
           CASE WHEN f.is_pride THEN 'pride_section' ELSE f.source END,
           f.is_pride,
           CASE WHEN f.is_pride THEN NULL ELSE f.image_path END,
           f.confidence,
           f.reason, f.status, f.created_at
    FROM public.content_flags f
    LEFT JOIN public.profiles pr ON pr.id = f.user_id
    WHERE (COALESCE(_status,'') = '' OR _status = 'all' OR f.status = _status)
    ORDER BY f.created_at DESC LIMIT 300;
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_flag(_id uuid, _action text, _suspend_days integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _action NOT IN ('approved','confirmed') THEN RAISE EXCEPTION 'Unknown action'; END IF;
  SELECT * INTO f FROM public.content_flags WHERE id = _id;
  IF f IS NULL THEN RAISE EXCEPTION 'Flag not found'; END IF;
  UPDATE public.content_flags SET status = _action, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = _id;
  IF _action = 'confirmed' AND _suspend_days IS NOT NULL AND f.user_id IS NOT NULL THEN
    UPDATE public.profiles
       SET suspended_until = now() + (_suspend_days || ' days')::interval,
           suspension_reason = 'Automated moderation violation confirmed by admin'
     WHERE id = f.user_id;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION
  public.admin_list_icebreaker_prompts(), public.admin_upsert_icebreaker_prompt(uuid,text,boolean),
  public.admin_delete_icebreaker_prompt(uuid), public.admin_set_today_icebreaker(uuid),
  public.admin_icebreaker_history(integer), public.admin_icebreaker_responses(date,integer),
  public.admin_list_challenges(), public.admin_upsert_challenge(uuid,text,text,text,integer,text,integer,text,boolean),
  public.admin_delete_challenge(uuid), public.admin_set_week_challenge(uuid), public.admin_challenge_stats(),
  public.admin_list_posts(text,integer), public.admin_delete_post(uuid),
  public.admin_list_verification(text), public.admin_set_verification(uuid,text,text),
  public.admin_revenue_stats(), public.admin_subscriber_trend(integer),
  public.admin_list_flags(text), public.admin_resolve_flag(uuid,text,integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.admin_list_icebreaker_prompts(), public.admin_upsert_icebreaker_prompt(uuid,text,boolean),
  public.admin_delete_icebreaker_prompt(uuid), public.admin_set_today_icebreaker(uuid),
  public.admin_icebreaker_history(integer), public.admin_icebreaker_responses(date,integer),
  public.admin_list_challenges(), public.admin_upsert_challenge(uuid,text,text,text,integer,text,integer,text,boolean),
  public.admin_delete_challenge(uuid), public.admin_set_week_challenge(uuid), public.admin_challenge_stats(),
  public.admin_list_posts(text,integer), public.admin_delete_post(uuid),
  public.admin_list_verification(text), public.admin_set_verification(uuid,text,text),
  public.admin_revenue_stats(), public.admin_subscriber_trend(integer),
  public.admin_list_flags(text), public.admin_resolve_flag(uuid,text,integer)
TO authenticated;