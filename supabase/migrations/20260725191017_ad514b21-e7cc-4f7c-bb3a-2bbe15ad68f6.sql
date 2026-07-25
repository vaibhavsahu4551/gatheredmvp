
-- Huddle Up connection requests
CREATE TABLE public.huddle_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_id <> to_id),
  UNIQUE (from_id, to_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.huddle_requests TO authenticated;
GRANT ALL ON public.huddle_requests TO service_role;
ALTER TABLE public.huddle_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own huddle requests" ON public.huddle_requests FOR SELECT TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = to_id);
CREATE POLICY "Send huddle request" ON public.huddle_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_id);
CREATE POLICY "Recipient updates status" ON public.huddle_requests FOR UPDATE TO authenticated
  USING (auth.uid() = to_id) WITH CHECK (auth.uid() = to_id);
CREATE POLICY "Sender cancels" ON public.huddle_requests FOR DELETE TO authenticated
  USING (auth.uid() = from_id);

CREATE INDEX huddle_requests_to_idx ON public.huddle_requests(to_id, status);
CREATE INDEX huddle_requests_from_idx ON public.huddle_requests(from_id, status);

CREATE TRIGGER huddle_requests_touch BEFORE UPDATE ON public.huddle_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: are two users mutually huddled?
CREATE OR REPLACE FUNCTION public.are_huddled(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.huddle_requests
    WHERE status = 'accepted'
      AND ((from_id = _a AND to_id = _b) OR (from_id = _b AND to_id = _a))
  );
$$;

-- DM threads (ordered pair)
CREATE TABLE public.dm_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_threads TO authenticated;
GRANT ALL ON public.dm_threads TO service_role;
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see thread" ON public.dm_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Huddled users create thread" ON public.dm_threads FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND public.are_huddled(user_a, user_b)
  );
CREATE TRIGGER dm_threads_touch BEFORE UPDATE ON public.dm_threads
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- DM messages
CREATE TABLE public.dm_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT,
  share_kind TEXT CHECK (share_kind IN ('post','event')),
  share_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_messages TO authenticated;
GRANT ALL ON public.dm_messages TO service_role;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_dm_member(_thread UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dm_threads WHERE id = _thread AND (user_a = _user OR user_b = _user));
$$;

CREATE POLICY "Members read dm" ON public.dm_messages FOR SELECT TO authenticated
  USING (public.is_dm_member(thread_id, auth.uid()));
CREATE POLICY "Members send dm" ON public.dm_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_dm_member(thread_id, auth.uid()));

CREATE INDEX dm_messages_thread_idx ON public.dm_messages(thread_id, created_at);

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own notifications delete" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
-- Inserts happen via trigger (SECURITY DEFINER); no direct INSERT policy needed.

CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- Trigger: create notifications for huddle request events
CREATE OR REPLACE FUNCTION public.huddle_request_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
    VALUES (NEW.to_id, 'huddle_request', NEW.from_id, NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
    VALUES (NEW.from_id, 'huddle_accepted', NEW.to_id, NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER huddle_request_notify_ins AFTER INSERT ON public.huddle_requests
FOR EACH ROW EXECUTE FUNCTION public.huddle_request_notify();
CREATE TRIGGER huddle_request_notify_upd AFTER UPDATE ON public.huddle_requests
FOR EACH ROW EXECUTE FUNCTION public.huddle_request_notify();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.huddle_requests;
