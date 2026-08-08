
-- ========== ICEBREAKERS ==========
CREATE TABLE public.icebreaker_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.icebreaker_prompts TO authenticated;
GRANT ALL ON public.icebreaker_prompts TO service_role;
ALTER TABLE public.icebreaker_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompts readable" ON public.icebreaker_prompts FOR SELECT TO authenticated USING (active);

CREATE TABLE public.daily_icebreakers (
  day date PRIMARY KEY,
  prompt_id uuid NOT NULL REFERENCES public.icebreaker_prompts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_icebreakers TO authenticated;
GRANT ALL ON public.daily_icebreakers TO service_role;
ALTER TABLE public.daily_icebreakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily readable" ON public.daily_icebreakers FOR SELECT TO authenticated USING (true);

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'post';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS icebreaker_day date;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES public.icebreaker_prompts(id);
CREATE UNIQUE INDEX IF NOT EXISTS posts_one_icebreaker_per_day
  ON public.posts (user_id, icebreaker_day) WHERE kind = 'icebreaker';

CREATE OR REPLACE FUNCTION public.roll_daily_icebreaker()
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d date := (now() AT TIME ZONE 'utc')::date; pid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.daily_icebreakers WHERE day = d) THEN RETURN d; END IF;
  SELECT p.id INTO pid FROM public.icebreaker_prompts p
   WHERE p.active
     AND NOT EXISTS (
       SELECT 1 FROM public.daily_icebreakers di
        WHERE di.prompt_id = p.id AND di.day > d - 30
     )
   ORDER BY random() LIMIT 1;
  IF pid IS NULL THEN
    SELECT p.id INTO pid FROM public.icebreaker_prompts p WHERE p.active ORDER BY random() LIMIT 1;
  END IF;
  IF pid IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.daily_icebreakers(day, prompt_id) VALUES (d, pid) ON CONFLICT DO NOTHING;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.get_today_icebreaker()
RETURNS TABLE(day date, prompt_id uuid, prompt text, answer_count integer, my_post_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d date;
BEGIN
  d := public.roll_daily_icebreaker();
  IF d IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT di.day, di.prompt_id, p.body,
      (SELECT count(*)::int FROM public.posts po WHERE po.kind = 'icebreaker' AND po.icebreaker_day = di.day),
      (SELECT po.id FROM public.posts po WHERE po.kind = 'icebreaker' AND po.icebreaker_day = di.day AND po.user_id = auth.uid() LIMIT 1)
    FROM public.daily_icebreakers di
    JOIN public.icebreaker_prompts p ON p.id = di.prompt_id
    WHERE di.day = d;
END $$;

-- Daily push announcing the new prompt (respects notification settings)
CREATE OR REPLACE FUNCTION public.announce_daily_icebreaker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE d date; txt text; r record;
BEGIN
  d := public.roll_daily_icebreaker();
  IF d IS NULL THEN RETURN; END IF;
  SELECT p.body INTO txt FROM public.daily_icebreakers di
    JOIN public.icebreaker_prompts p ON p.id = di.prompt_id WHERE di.day = d;
  FOR r IN
    SELECT pr.id FROM public.profiles pr
    WHERE pr.onboarding_complete
      AND COALESCE((SELECT s.push_enabled FROM public.user_settings s WHERE s.user_id = pr.id), true)
  LOOP
    PERFORM private.dispatch_push(r.id, 'Today''s icebreaker', txt, '/icebreaker');
  END LOOP;
EXCEPTION WHEN others THEN RETURN;
END $$;

-- ========== WEEKLY CHALLENGES ==========
CREATE TABLE public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  goal_type text NOT NULL,
  goal_target integer NOT NULL DEFAULT 1,
  reward_kind text NOT NULL DEFAULT 'badge',
  reward_amount integer NOT NULL DEFAULT 0,
  badge_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weekly_challenges TO authenticated;
GRANT ALL ON public.weekly_challenges TO service_role;
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges readable" ON public.weekly_challenges FOR SELECT TO authenticated USING (active);

CREATE TABLE public.weekly_challenge_assignments (
  week_start date PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.weekly_challenges(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weekly_challenge_assignments TO authenticated;
GRANT ALL ON public.weekly_challenge_assignments TO service_role;
ALTER TABLE public.weekly_challenge_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments readable" ON public.weekly_challenge_assignments FOR SELECT TO authenticated USING (true);

CREATE TABLE public.challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  challenge_id uuid REFERENCES public.weekly_challenges(id),
  reward_kind text,
  reward_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT ON public.challenge_completions TO authenticated;
GRANT ALL ON public.challenge_completions TO service_role;
ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completions" ON public.challenge_completions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.roll_weekly_challenge()
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE ws date := (date_trunc('week', now() AT TIME ZONE 'utc'))::date; cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.weekly_challenge_assignments WHERE week_start = ws) THEN RETURN ws; END IF;
  SELECT c.id INTO cid FROM public.weekly_challenges c
   WHERE c.active
   ORDER BY COALESCE((SELECT max(a.week_start) FROM public.weekly_challenge_assignments a WHERE a.challenge_id = c.id), '1970-01-01'::date) ASC,
            random()
   LIMIT 1;
  IF cid IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.weekly_challenge_assignments(week_start, challenge_id) VALUES (ws, cid) ON CONFLICT DO NOTHING;
  RETURN ws;
END $$;

CREATE OR REPLACE FUNCTION private.challenge_progress(_user uuid, _goal text, _since timestamptz)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer := 0;
BEGIN
  IF _goal = 'join_event_count' THEN
    SELECT count(*)::int INTO n FROM public.event_participants ep
      JOIN public.events e ON e.id = ep.event_id
     WHERE ep.user_id = _user AND ep.status = 'approved' AND ep.created_at >= _since
       AND COALESCE(e.is_pride, false) = false;
  ELSIF _goal = 'host_event_count' THEN
    SELECT count(*)::int INTO n FROM public.events e
     WHERE e.host_id = _user AND e.created_at >= _since AND COALESCE(e.is_pride, false) = false;
  ELSIF _goal = 'linkup_accepted_count' THEN
    SELECT count(*)::int INTO n FROM public.huddle_requests h
     WHERE h.status = 'accepted' AND h.updated_at >= _since
       AND (h.from_id = _user OR h.to_id = _user);
  ELSIF _goal = 'post_count' THEN
    SELECT count(*)::int INTO n FROM public.posts p
     WHERE p.user_id = _user AND p.created_at >= _since;
  END IF;
  RETURN COALESCE(n, 0);
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_challenge()
RETURNS TABLE(week_start date, challenge_id uuid, title text, description text, goal_type text,
              goal_target integer, reward_kind text, reward_amount integer, badge_name text,
              progress integer, completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE ws date;
BEGIN
  ws := public.roll_weekly_challenge();
  IF ws IS NULL OR auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT a.week_start, c.id, c.title, c.description, c.goal_type, c.goal_target,
           c.reward_kind, c.reward_amount, c.badge_name,
           LEAST(private.challenge_progress(auth.uid(), c.goal_type, a.week_start::timestamptz), c.goal_target),
           EXISTS (SELECT 1 FROM public.challenge_completions cc WHERE cc.user_id = auth.uid() AND cc.week_start = a.week_start)
      FROM public.weekly_challenge_assignments a
      JOIN public.weekly_challenges c ON c.id = a.challenge_id
     WHERE a.week_start = ws;
END $$;

CREATE OR REPLACE FUNCTION public.claim_weekly_challenge()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE me uuid := auth.uid(); ws date; c record; prog integer; detail text; ev uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  ws := public.roll_weekly_challenge();
  IF ws IS NULL THEN RAISE EXCEPTION 'No challenge this week'; END IF;
  IF EXISTS (SELECT 1 FROM public.challenge_completions WHERE user_id = me AND week_start = ws) THEN
    RETURN 'already';
  END IF;
  SELECT ch.* INTO c FROM public.weekly_challenge_assignments a
    JOIN public.weekly_challenges ch ON ch.id = a.challenge_id WHERE a.week_start = ws;
  prog := private.challenge_progress(me, c.goal_type, ws::timestamptz);
  IF prog < c.goal_target THEN RAISE EXCEPTION 'Challenge not complete yet'; END IF;

  IF c.reward_kind = 'badge' THEN
    INSERT INTO public.user_badges(user_id, badge, reason)
      VALUES (me, COALESCE(c.badge_name, 'Achiever'), 'Weekly challenge: ' || c.title)
      ON CONFLICT (user_id, badge) DO NOTHING;
    detail := COALESCE(c.badge_name, 'Achiever');
  ELSIF c.reward_kind = 'trial' THEN
    UPDATE public.profiles
       SET subscription_tier = 'premium',
           premium_expires_at = GREATEST(COALESCE(premium_expires_at, now()), now()) + (GREATEST(c.reward_amount, 1) || ' days')::interval
     WHERE id = me;
    detail := GREATEST(c.reward_amount, 1) || ' premium days';
  ELSIF c.reward_kind = 'boost' THEN
    SELECT id INTO ev FROM public.events
      WHERE host_id = me AND status IN ('pending','confirmed') AND COALESCE(is_pride, false) = false
      ORDER BY starts_at ASC LIMIT 1;
    IF ev IS NOT NULL THEN
      UPDATE public.events SET boost_weight = GREATEST(boost_weight, 100) WHERE id = ev;
      detail := 'Event boosted';
    ELSE
      detail := 'Boost credit (create an event to use it)';
    END IF;
  END IF;

  INSERT INTO public.challenge_completions(user_id, week_start, challenge_id, reward_kind, reward_detail)
    VALUES (me, ws, c.id, c.reward_kind, detail);
  RETURN COALESCE(detail, 'done');
END $$;

-- ========== SEED ==========
INSERT INTO public.icebreaker_prompts (body) VALUES
 ('What''s your comfort food?'),
 ('What''s your dream travel destination?'),
 ('Which movie deserves a sequel?'),
 ('What song is stuck in your head today?'),
 ('Best meal you''ve had in this city?'),
 ('Tea or coffee — and how do you take it?'),
 ('What''s a hobby you picked up recently?'),
 ('Which fictional character would you hang out with?'),
 ('What''s your go-to karaoke song?'),
 ('Beach day or mountain trek?'),
 ('What''s the last thing that made you laugh out loud?'),
 ('One app you can''t live without?'),
 ('What''s your ideal Sunday?'),
 ('Most underrated snack of all time?'),
 ('What skill would you learn if time was free?'),
 ('Night owl or early bird?'),
 ('Best concert or gig you''ve been to?'),
 ('What''s a show you''d rewatch from scratch?'),
 ('If you could host any kind of meetup, what would it be?'),
 ('What''s one thing on your bucket list this year?');

INSERT INTO public.weekly_challenges (title, description, goal_type, goal_target, reward_kind, reward_amount, badge_name) VALUES
 ('Attend your first event', 'Join any Gathr event this week.', 'join_event_count', 1, 'badge', 0, 'First Steps'),
 ('Join one coffee meetup', 'Join an event this week and show up.', 'join_event_count', 1, 'boost', 0, NULL),
 ('Meet 2 new people this week', 'Get 2 Linkup requests accepted.', 'linkup_accepted_count', 2, 'badge', 0, 'Social Butterfly'),
 ('Host a game night', 'Host an event this week.', 'host_event_count', 1, 'badge', 0, 'Host Star'),
 ('Double up', 'Join 2 events this week.', 'join_event_count', 2, 'trial', 3, NULL),
 ('Share the vibe', 'Post 3 times this week.', 'post_count', 3, 'badge', 0, 'Storyteller');
