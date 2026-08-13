DROP POLICY IF EXISTS "event photos readable by signed-in" ON storage.objects;
CREATE POLICY "event photos readable by signed-in"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-photos');

DROP POLICY IF EXISTS "event photos insert own folder" ON storage.objects;
CREATE POLICY "event photos insert own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "event photos update own folder" ON storage.objects;
CREATE POLICY "event photos update own folder"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'event-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "event photos delete own folder" ON storage.objects;
CREATE POLICY "event photos delete own folder"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-photos' AND (storage.foldername(name))[1] = auth.uid()::text);