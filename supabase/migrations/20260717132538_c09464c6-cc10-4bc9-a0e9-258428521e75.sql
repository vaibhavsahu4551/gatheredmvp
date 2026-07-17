
-- Enums
CREATE TYPE public.event_category AS ENUM ('Gaming','Coffee','Dinner','Movie','Hangout','Sports','Party');
CREATE TYPE public.event_status AS ENUM ('pending','confirmed','cancelled','completed');
CREATE TYPE public.participant_status AS ENUM ('pending','approved','rejected','cancelled');

-- Helper: is user verified
CREATE OR REPLACE FUNCTION public.is_verified(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.verification_status WHERE user_id = _user AND status = 'verified');
$$;

-- EVENTS
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category public.event_category NOT NULL,
  starts_at timestamptz NOT NULL,
  location_address text NOT NULL,
  location_lat double precision,
  location_lng double precision,
  city text NOT NULL,
  min_size int NOT NULL CHECK (min_size >= 4),
  max_size int NOT NULL,
  entry_fee numeric,
  min_girls int,
  min_boys int,
  auto_cancel_hours int NOT NULL DEFAULT 2,
  status public.event_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_size >= min_size)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Verified users can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id AND public.is_verified(auth.uid()));
CREATE POLICY "Host updates own event" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host deletes own event" ON public.events FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- PARTICIPANTS
CREATE TABLE public.event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.participant_status NOT NULL DEFAULT 'pending',
  gender text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_participants TO authenticated;
GRANT ALL ON public.event_participants TO service_role;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Helper: is host
CREATE OR REPLACE FUNCTION public.is_event_host(_event uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.events WHERE id = _event AND host_id = _user);
$$;

-- Helper: is approved member
CREATE OR REPLACE FUNCTION public.is_event_member(_event uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.event_participants WHERE event_id = _event AND user_id = _user AND status = 'approved')
      OR public.is_event_host(_event, _user);
$$;

CREATE POLICY "Members view participants" ON public.event_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_event_host(event_id, auth.uid()) OR public.is_event_member(event_id, auth.uid()));
CREATE POLICY "Verified users request join" ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_verified(auth.uid()) AND status = 'pending');
CREATE POLICY "Host or self updates participant" ON public.event_participants FOR UPDATE TO authenticated
  USING (public.is_event_host(event_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_event_host(event_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Self or host deletes participant" ON public.event_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_event_host(event_id, auth.uid()));

-- CHAT GROUPS
CREATE TABLE public.chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_groups TO authenticated;
GRANT ALL ON public.chat_groups TO service_role;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view group" ON public.chat_groups FOR SELECT TO authenticated
  USING (public.is_event_member(event_id, auth.uid()));

-- CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.chat_groups g WHERE g.id = _group AND public.is_event_member(g.event_id, _user)
  );
$$;

CREATE POLICY "Members read messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

-- POSTS
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city text NOT NULL,
  photo_url text,
  caption text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Verified users create posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_verified(auth.uid()));
CREATE POLICY "Users update own posts" ON public.posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own posts" ON public.posts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POST LIKES
CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view likes" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users unlike own" ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POST COMMENTS
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view comments" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_verified(auth.uid()));
CREATE POLICY "Users delete own comments" ON public.post_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Auto-confirm & auto-create chat group when min_size reached
CREATE OR REPLACE FUNCTION public.check_event_confirmation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  approved_count int;
  ev record;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;
  IF ev.status = 'pending' THEN
    SELECT count(*) INTO approved_count FROM public.event_participants
      WHERE event_id = NEW.event_id AND status = 'approved';
    IF approved_count >= ev.min_size THEN
      UPDATE public.events SET status = 'confirmed' WHERE id = ev.id;
      INSERT INTO public.chat_groups(event_id) VALUES (ev.id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_check_event_confirmation
  AFTER INSERT OR UPDATE OF status ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.check_event_confirmation();

-- updated_at triggers
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_event_participants_updated BEFORE UPDATE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- Feed photos storage bucket handled separately via tool.
