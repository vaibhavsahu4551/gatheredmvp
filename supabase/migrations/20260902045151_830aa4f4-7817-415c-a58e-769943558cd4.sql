CREATE POLICY "Users upload own payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner or admin views payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR private.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins delete payment proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND private.has_role(auth.uid(), 'admin'));