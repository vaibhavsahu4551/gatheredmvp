
-- 1) Pride profile: the separate identity
CREATE TABLE public.pride_profiles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pride_id      uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  display_name  text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 2 AND 40),
  photo_path    text,
  bio           text CHECK (bio IS NULL OR length(bio) <= 200),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pride_profiles TO authenticated;
GRANT ALL ON public.pride_profiles TO service_role;
ALTER TABLE public.pride_profiles ENABLE ROW LEVEL SECURITY;

-- Only the owner can see/modify their pride_profile row (the real→pride linkage).
CREATE POLICY "own pride profile read"  ON public.pride_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pride profile write" ON public.pride_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pride profile edit"  ON public.pride_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pride profile del"   ON public.pride_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER pride_profiles_touch BEFORE UPDATE ON public.pride_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Violations / strikes
CREATE TABLE public.pride_violations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  details     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pride_violations TO authenticated;
GRANT ALL ON public.pride_violations TO service_role;
ALTER TABLE public.pride_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own violations read" ON public.pride_violations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "self report violation" ON public.pride_violations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX pride_violations_user_idx ON public.pride_violations(user_id);

CREATE OR REPLACE FUNCTION public.pride_suspended(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT count(*) FROM public.pride_violations WHERE user_id = _user), 0) >= 3;
$$;

-- 3) Public actor-id columns for Pride content (never exposes real user_id)
ALTER TABLE public.events              ADD COLUMN IF NOT EXISTS pride_actor_id uuid;
ALTER TABLE public.event_participants  ADD COLUMN IF NOT EXISTS pride_actor_id uuid;
ALTER TABLE public.event_comments      ADD COLUMN IF NOT EXISTS pride_actor_id uuid;
ALTER TABLE public.chat_messages       ADD COLUMN IF NOT EXISTS pride_actor_id uuid;

CREATE INDEX IF NOT EXISTS events_pride_actor_idx      ON public.events(pride_actor_id)             WHERE pride_actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ep_pride_actor_idx          ON public.event_participants(pride_actor_id) WHERE pride_actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ec_pride_actor_idx          ON public.event_comments(pride_actor_id)     WHERE pride_actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cm_pride_actor_idx          ON public.chat_messages(pride_actor_id)      WHERE pride_actor_id IS NOT NULL;

-- 4) Trigger: set pride_actor_id automatically when acting in a Pride context.
--    Also blocks any Pride action for suspended users.

CREATE OR REPLACE FUNCTION public.fill_event_pride_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  IF NEW.is_pride THEN
    IF public.pride_suspended(NEW.host_id) THEN
      RAISE EXCEPTION 'Pride access is suspended for this account.';
    END IF;
    SELECT pride_id INTO pid FROM public.pride_profiles WHERE user_id = NEW.host_id;
    IF pid IS NULL THEN
      RAISE EXCEPTION 'Pride identity not set up. Please create your Pride profile first.';
    END IF;
    NEW.pride_actor_id := pid;
  ELSE
    NEW.pride_actor_id := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS events_fill_pride_actor ON public.events;
CREATE TRIGGER events_fill_pride_actor
  BEFORE INSERT OR UPDATE OF is_pride, host_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.fill_event_pride_actor();

CREATE OR REPLACE FUNCTION public.fill_ep_pride_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_p boolean; pid uuid;
BEGIN
  SELECT is_pride INTO is_p FROM public.events WHERE id = NEW.event_id;
  IF is_p THEN
    IF public.pride_suspended(NEW.user_id) THEN
      RAISE EXCEPTION 'Pride access is suspended for this account.';
    END IF;
    SELECT pride_id INTO pid FROM public.pride_profiles WHERE user_id = NEW.user_id;
    IF pid IS NULL THEN
      RAISE EXCEPTION 'Set up your Pride identity before joining a Pride event.';
    END IF;
    NEW.pride_actor_id := pid;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ep_fill_pride_actor ON public.event_participants;
CREATE TRIGGER ep_fill_pride_actor
  BEFORE INSERT ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.fill_ep_pride_actor();

CREATE OR REPLACE FUNCTION public.fill_ec_pride_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_p boolean; pid uuid;
BEGIN
  SELECT is_pride INTO is_p FROM public.events WHERE id = NEW.event_id;
  IF is_p THEN
    IF public.pride_suspended(NEW.user_id) THEN
      RAISE EXCEPTION 'Pride access is suspended for this account.';
    END IF;
    SELECT pride_id INTO pid FROM public.pride_profiles WHERE user_id = NEW.user_id;
    IF pid IS NULL THEN
      RAISE EXCEPTION 'Set up your Pride identity before commenting.';
    END IF;
    NEW.pride_actor_id := pid;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ec_fill_pride_actor ON public.event_comments;
CREATE TRIGGER ec_fill_pride_actor
  BEFORE INSERT ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION public.fill_ec_pride_actor();

CREATE OR REPLACE FUNCTION public.fill_cm_pride_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev uuid; is_p boolean; pid uuid;
BEGIN
  SELECT event_id INTO ev FROM public.chat_groups WHERE id = NEW.group_id;
  IF ev IS NULL THEN RETURN NEW; END IF;
  SELECT is_pride INTO is_p FROM public.events WHERE id = ev;
  IF is_p THEN
    IF public.pride_suspended(NEW.user_id) THEN
      RAISE EXCEPTION 'Pride access is suspended for this account.';
    END IF;
    SELECT pride_id INTO pid FROM public.pride_profiles WHERE user_id = NEW.user_id;
    IF pid IS NULL THEN
      RAISE EXCEPTION 'Set up your Pride identity before chatting.';
    END IF;
    NEW.pride_actor_id := pid;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cm_fill_pride_actor ON public.chat_messages;
CREATE TRIGGER cm_fill_pride_actor
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.fill_cm_pride_actor();

-- 5) Secure lookup for pride identities by pride_id (never returns user_id).
CREATE OR REPLACE FUNCTION public.get_pride_identities(_pride_ids uuid[])
RETURNS TABLE(pride_id uuid, display_name text, photo_path text, bio text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.pride_id, pp.display_name, pp.photo_path, pp.bio
  FROM public.pride_profiles pp
  WHERE pp.pride_id = ANY(_pride_ids)
    AND public.has_pride_access(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.get_pride_identities(uuid[]) TO authenticated;
