-- ============ CIRCLES ============
CREATE TABLE public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  photo_path text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circles TO authenticated;
GRANT ALL ON public.circles TO service_role;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_members TO authenticated;
GRANT ALL ON public.circle_members TO service_role;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.is_circle_member(_circle uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.circle_members m WHERE m.circle_id = _circle AND m.user_id = _user);
$$;

CREATE OR REPLACE FUNCTION private.is_circle_owner(_circle uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.circles c WHERE c.id = _circle AND c.created_by = _user);
$$;

CREATE POLICY "Members read circles" ON public.circles FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR private.is_circle_member(id, auth.uid()));
CREATE POLICY "Users create circles" ON public.circles FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner updates circle" ON public.circles FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner deletes circle" ON public.circles FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Members read circle members" ON public.circle_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_circle_member(circle_id, auth.uid()) OR private.is_circle_owner(circle_id, auth.uid()));
CREATE POLICY "Owner adds members" ON public.circle_members FOR INSERT TO authenticated
  WITH CHECK (private.is_circle_owner(circle_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Owner or self removes membership" ON public.circle_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_circle_owner(circle_id, auth.uid()));

CREATE TRIGGER circles_touch BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CIRCLE GROUP CHAT ============
ALTER TABLE public.chat_groups ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE public.chat_groups ADD COLUMN circle_id uuid UNIQUE REFERENCES public.circles(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.chat_groups g
    WHERE g.id = _group
      AND (
        (g.event_id IS NOT NULL AND private.is_event_member(g.event_id, _user))
        OR (g.circle_id IS NOT NULL AND private.is_circle_member(g.circle_id, _user))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.create_circle_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_groups (circle_id) VALUES (NEW.id);
  INSERT INTO public.circle_members (circle_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER circles_after_insert AFTER INSERT ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.create_circle_chat();

-- ============ EVENTS ============
ALTER TABLE public.events
  ADD COLUMN beginner_friendly boolean NOT NULL DEFAULT false,
  ADD COLUMN circle_id uuid REFERENCES public.circles(id) ON DELETE SET NULL;

-- ============ BADGE CATALOGUE ============
CREATE TABLE public.badge_catalog (
  badge text PRIMARY KEY,
  label text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'award',
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badge_catalog TO authenticated;
GRANT ALL ON public.badge_catalog TO service_role;
ALTER TABLE public.badge_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in members read badges" ON public.badge_catalog FOR SELECT TO authenticated USING (true);

CREATE TRIGGER badge_catalog_touch BEFORE UPDATE ON public.badge_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.badge_catalog (badge, label, description, icon, priority) VALUES
  ('Supporter', 'Supporter', 'Redeemed with reward points for backing Gathr.', 'heart', 30),
  ('Host Star', 'Host Star', 'Awarded for hosting great Gathrs.', 'star', 20),
  ('Challenge Champ', 'Challenge Champ', 'Completed a Weekly Challenge.', 'trophy', 10),
  ('Connector', 'Connector', 'Brought new members to Gathr through referrals.', 'users', 40)
ON CONFLICT (badge) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_list_badge_catalog()
RETURNS TABLE(badge text, label text, description text, icon text, priority integer, active boolean, awarded integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.badge, b.label, b.description, b.icon, b.priority, b.active,
         (SELECT count(*)::int FROM public.user_badges ub WHERE ub.badge = b.badge)
  FROM public.badge_catalog b
  WHERE private.has_role(auth.uid(), 'admin')
  ORDER BY b.priority ASC, b.label ASC;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_badge_catalog(
  _badge text, _label text, _description text, _icon text, _priority integer, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.badge_catalog (badge, label, description, icon, priority, active)
  VALUES (_badge, _label, _description, _icon, coalesce(_priority, 100), coalesce(_active, true))
  ON CONFLICT (badge) DO UPDATE SET
    label = EXCLUDED.label, description = EXCLUDED.description, icon = EXCLUDED.icon,
    priority = EXCLUDED.priority, active = EXCLUDED.active, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_badge_catalog() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_badge_catalog(text, text, text, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_badge_catalog() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_badge_catalog(text, text, text, text, integer, boolean) TO authenticated, service_role;