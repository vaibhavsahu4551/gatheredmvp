DROP POLICY IF EXISTS "Verified users create posts" ON public.posts;
CREATE POLICY "Users create own posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());