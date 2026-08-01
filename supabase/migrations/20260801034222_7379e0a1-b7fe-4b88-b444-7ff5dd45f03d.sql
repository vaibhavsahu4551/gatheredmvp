
DROP POLICY IF EXISTS "own tokens update" ON public.push_tokens;
CREATE POLICY "own tokens update" ON public.push_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
