-- Feed / posts
CREATE INDEX IF NOT EXISTS posts_created_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_event_idx ON public.posts (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_icebreaker_idx ON public.posts (kind, icebreaker_day) WHERE kind = 'icebreaker';

-- Likes / comments
CREATE INDEX IF NOT EXISTS post_likes_post_idx ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_idx ON public.post_likes (user_id);
CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON public.post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS post_comments_user_idx ON public.post_comments (user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS notifications_user_pride_created_idx ON public.notifications (user_id, is_pride, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id, is_pride) WHERE read_at IS NULL;

-- Linkups
CREATE INDEX IF NOT EXISTS huddle_requests_from_idx ON public.huddle_requests (from_id, status);
CREATE INDEX IF NOT EXISTS huddle_requests_to_idx ON public.huddle_requests (to_id, status);

-- DMs / blocks
CREATE INDEX IF NOT EXISTS dm_threads_user_a_idx ON public.dm_threads (user_a, updated_at DESC);
CREATE INDEX IF NOT EXISTS dm_threads_user_b_idx ON public.dm_threads (user_b, updated_at DESC);
CREATE INDEX IF NOT EXISTS dm_messages_sender_idx ON public.dm_messages (sender_id);
CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);

-- Stories
CREATE INDEX IF NOT EXISTS stories_pride_expires_idx ON public.stories (is_pride, expires_at DESC);
CREATE INDEX IF NOT EXISTS stories_user_created_idx ON public.stories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS story_views_viewer_idx ON public.story_views (viewer_id);

-- Circles / chat
CREATE INDEX IF NOT EXISTS circle_members_user_idx ON public.circle_members (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON public.chat_messages (user_id);

-- Rewards
CREATE INDEX IF NOT EXISTS points_tx_user_created_idx ON public.points_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_badges_user_idx ON public.user_badges (user_id);
CREATE INDEX IF NOT EXISTS challenge_completions_user_idx ON public.challenge_completions (user_id, week_start DESC);

-- Profiles / discovery
CREATE INDEX IF NOT EXISTS profiles_interests_gin_idx ON public.profiles USING gin (interests);
CREATE INDEX IF NOT EXISTS profiles_city_idx ON public.profiles (city) WHERE onboarding_complete;
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by) WHERE referred_by IS NOT NULL;

-- Events
CREATE INDEX IF NOT EXISTS events_pride_status_starts_idx ON public.events (is_pride, status, starts_at);
CREATE INDEX IF NOT EXISTS events_circle_idx ON public.events (circle_id) WHERE circle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_cohost_idx ON public.events (cohost_id) WHERE cohost_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_open_idx ON public.events (starts_at) WHERE closed_at IS NULL;

-- Misc FK lookups
CREATE INDEX IF NOT EXISTS event_checkins_user_idx ON public.event_checkins (user_id);
CREATE INDEX IF NOT EXISTS event_comments_user_idx ON public.event_comments (user_id);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS suggestion_dismissals_user_idx ON public.suggestion_dismissals (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_id);
