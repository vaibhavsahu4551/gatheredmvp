
-- Revoke public execute on SECURITY DEFINER trigger functions (called only by triggers)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.selfie_uploaded() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Storage RLS: users can only manage files inside a folder named after their user id
create policy "Users upload own profile photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Authenticated view profile photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos');

create policy "Users delete own profile photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own profile photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Selfies: user can upload and view own; nobody else
create policy "Users upload own selfie"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users view own selfie"
  on storage.objects for select to authenticated
  using (bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own selfie"
  on storage.objects for delete to authenticated
  using (bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text);
