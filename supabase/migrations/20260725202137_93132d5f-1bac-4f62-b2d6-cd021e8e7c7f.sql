
CREATE INDEX IF NOT EXISTS posts_created_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_status_starts_idx ON public.events (status, starts_at);
CREATE INDEX IF NOT EXISTS events_host_idx ON public.events (host_id);
CREATE INDEX IF NOT EXISTS event_participants_user_idx ON public.event_participants (user_id);
CREATE INDEX IF NOT EXISTS event_participants_event_status_idx ON public.event_participants (event_id, status);
CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON public.post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_group_created_idx ON public.chat_messages (group_id, created_at);
