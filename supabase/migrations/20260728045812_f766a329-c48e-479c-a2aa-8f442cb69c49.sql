
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS voice_url text,
  ADD COLUMN IF NOT EXISTS voice_duration_ms integer;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS voice_url text,
  ADD COLUMN IF NOT EXISTS voice_duration_ms integer;

-- Allow body to be null when a voice note is sent
ALTER TABLE public.dm_messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.chat_messages ALTER COLUMN body DROP NOT NULL;

-- Storage policies for voice-notes bucket
CREATE POLICY "Users upload own voice notes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated can read voice notes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-notes');

CREATE POLICY "Users delete own voice notes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
