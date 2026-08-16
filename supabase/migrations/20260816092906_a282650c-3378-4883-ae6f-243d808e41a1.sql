CREATE POLICY "Authenticated read music" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'music');
CREATE POLICY "Admins write music" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'music' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update music" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'music' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete music" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'music' AND private.has_role(auth.uid(), 'admin'));