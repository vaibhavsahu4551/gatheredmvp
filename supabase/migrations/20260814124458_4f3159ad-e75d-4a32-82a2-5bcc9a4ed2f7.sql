CREATE OR REPLACE FUNCTION public.join_circle_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT c.id INTO _id FROM public.circles c WHERE upper(c.invite_code) = upper(trim(_code));
  IF _id IS NULL THEN RAISE EXCEPTION 'Invite link is not valid'; END IF;
  INSERT INTO public.circle_members (circle_id, user_id) VALUES (_id, auth.uid())
    ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_circle_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_circle_by_code(text) TO authenticated, service_role;