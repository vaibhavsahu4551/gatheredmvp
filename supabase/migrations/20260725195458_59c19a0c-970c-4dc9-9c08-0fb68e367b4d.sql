DROP POLICY IF EXISTS "Users view own feed photos" ON storage.objects;
CREATE POLICY "Anyone authenticated can view feed photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'feed-photos');
DROP POLICY IF EXISTS "Authenticated view profile photos" ON storage.objects;
CREATE POLICY "Anyone authenticated can view profile photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'profile-photos');