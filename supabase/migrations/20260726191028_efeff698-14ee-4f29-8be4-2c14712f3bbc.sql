
ALTER TABLE public.dm_threads
  ADD COLUMN IF NOT EXISTS last_read_a timestamptz,
  ADD COLUMN IF NOT EXISTS last_read_b timestamptz;

CREATE OR REPLACE FUNCTION public.get_dm_unread()
RETURNS TABLE(thread_id uuid, unread int, last_body text, last_sender uuid, last_created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.id,
    (SELECT count(*)::int FROM public.dm_messages m
       WHERE m.thread_id = t.id
         AND m.sender_id <> auth.uid()
         AND m.created_at > COALESCE(
           CASE WHEN t.user_a = auth.uid() THEN t.last_read_a ELSE t.last_read_b END,
           'epoch'::timestamptz)),
    (SELECT COALESCE(m.body, CASE WHEN m.share_kind IS NOT NULL THEN 'Shared ' || m.share_kind ELSE '' END)
       FROM public.dm_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1),
    (SELECT m.sender_id FROM public.dm_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1),
    (SELECT m.created_at FROM public.dm_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1)
  FROM public.dm_threads t
  WHERE t.user_a = auth.uid() OR t.user_b = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.mark_dm_read(_thread uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.dm_threads
    SET last_read_a = CASE WHEN user_a = auth.uid() THEN now() ELSE last_read_a END,
        last_read_b = CASE WHEN user_b = auth.uid() THEN now() ELSE last_read_b END
    WHERE id = _thread AND (user_a = auth.uid() OR user_b = auth.uid());
END $$;

GRANT EXECUTE ON FUNCTION public.get_dm_unread() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dm_read(uuid) TO authenticated;
