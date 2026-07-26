
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. Reports: status + reviewer
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE POLICY "Admins manage reports" ON public.reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Profiles: suspension
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. App settings (singleton)
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  subscription_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (id, subscription_enabled) VALUES (1, false) ON CONFLICT DO NOTHING;

-- 5. Home banners
CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_banners TO anon, authenticated;
GRANT ALL ON public.home_banners TO service_role;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads banners" ON public.home_banners FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage banners" ON public.home_banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER home_banners_touch BEFORE UPDATE ON public.home_banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Admin RLS access to moderation-relevant tables (Pride excluded in application layer)
CREATE POLICY "Admins view events" ON public.events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete events" ON public.events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND is_pride = false);

CREATE POLICY "Admins view posts" ON public.posts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete posts" ON public.posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view dm messages" ON public.dm_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view chat messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Admin user creation
DO $$
DECLARE
  new_uid uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin4469@gathr.admin') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
      'admin4469@gathr.admin', crypt('@gathradmin4469', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
      '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid,
            jsonb_build_object('sub', new_uid::text, 'email', 'admin4469@gathr.admin'),
            'email', new_uid::text, now(), now(), now());

    -- Ensure profile exists (trigger should create it) and mark onboarded
    INSERT INTO public.profiles (id, full_name, onboarding_complete)
      VALUES (new_uid, 'Admin', true)
      ON CONFLICT (id) DO UPDATE SET full_name = 'Admin', onboarding_complete = true;

    INSERT INTO public.user_roles (user_id, role) VALUES (new_uid, 'admin')
      ON CONFLICT DO NOTHING;
  END IF;
END $$;
