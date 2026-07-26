
CREATE POLICY "pride photos: read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pride-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pride photos: write own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pride-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pride photos: update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pride-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pride photos: delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pride-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
