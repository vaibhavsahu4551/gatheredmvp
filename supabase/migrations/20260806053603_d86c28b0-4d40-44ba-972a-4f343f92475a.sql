CREATE POLICY "Users upload their own story media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Signed-in members can read story media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories');

CREATE POLICY "Users delete their own story media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);