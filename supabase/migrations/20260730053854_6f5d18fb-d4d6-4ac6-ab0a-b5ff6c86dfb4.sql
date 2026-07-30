
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  notify_likes boolean NOT NULL DEFAULT true,
  notify_comments boolean NOT NULL DEFAULT true,
  notify_join_requests boolean NOT NULL DEFAULT true,
  notify_messages boolean NOT NULL DEFAULT true,
  notify_linkups boolean NOT NULL DEFAULT true,
  linkup_privacy text NOT NULL DEFAULT 'everyone' CHECK (linkup_privacy IN ('everyone','no_one')),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own settings select" ON public.user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own settings insert" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own settings update" ON public.user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_settings_touch BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  screenshot_path text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tickets select" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "own tickets insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER support_tickets_touch BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Notification preference helper
CREATE OR REPLACE FUNCTION private.notif_allowed(_user uuid, _kind text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT s.push_enabled AND CASE
      WHEN _kind = 'post_like' THEN s.notify_likes
      WHEN _kind = 'post_comment' THEN s.notify_comments
      WHEN _kind IN ('join_request','join_approved','join_declined') THEN s.notify_join_requests
      WHEN _kind IN ('huddle_request','huddle_accepted') THEN s.notify_linkups
      ELSE true
    END
    FROM public.user_settings s WHERE s.user_id = _user
  ), true);
$$;

REVOKE ALL ON FUNCTION private.notif_allowed(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.post_like_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id AND private.notif_allowed(owner, 'post_like') THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
    VALUES (owner, 'post_like', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.post_comment_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id AND private.notif_allowed(owner, 'post_comment') THEN
    INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
    VALUES (owner, 'post_comment', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.huddle_request_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF private.notif_allowed(NEW.to_id, 'huddle_request') THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
      VALUES (NEW.to_id, 'huddle_request', NEW.from_id, NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    IF private.notif_allowed(NEW.from_id, 'huddle_accepted') THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id)
      VALUES (NEW.from_id, 'huddle_accepted', NEW.to_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.event_participant_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE host uuid; is_p boolean;
BEGIN
  SELECT host_id, is_pride INTO host, is_p FROM public.events WHERE id = NEW.event_id;
  IF host IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.user_id <> host THEN
    IF private.notif_allowed(host, 'join_request') THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id, is_pride)
      VALUES (host, 'join_request', NEW.user_id, NEW.event_id, COALESCE(is_p, false));
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'approved' AND private.notif_allowed(NEW.user_id, 'join_approved') THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id, is_pride)
      VALUES (NEW.user_id, 'join_approved', host, NEW.event_id, COALESCE(is_p, false));
    ELSIF NEW.status = 'rejected' AND private.notif_allowed(NEW.user_id, 'join_declined') THEN
      INSERT INTO public.notifications(user_id, kind, actor_id, target_id, is_pride)
      VALUES (NEW.user_id, 'join_declined', host, NEW.event_id, COALESCE(is_p, false));
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Linkup privacy enforcement
CREATE OR REPLACE FUNCTION public.enforce_linkup_privacy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_settings s WHERE s.user_id = NEW.to_id AND s.linkup_privacy = 'no_one') THEN
    RAISE EXCEPTION 'This member is not accepting Linkup requests right now.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER huddle_requests_privacy BEFORE INSERT ON public.huddle_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_linkup_privacy();
