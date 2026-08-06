CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_path text NOT NULL,
  media_type text NOT NULL DEFAULT 'photo',
  text_overlay text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  music_title text,
  music_artist text,
  music_url text,
  music_start_ms integer NOT NULL DEFAULT 0,
  music_end_ms integer NOT NULL DEFAULT 15000,
  music_attribution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX stories_active_idx ON public.stories (expires_at DESC, created_at DESC);
CREATE INDEX stories_user_idx ON public.stories (user_id);

GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active stories are visible to signed-in members"
  ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now() OR user_id = auth.uid());

CREATE POLICY "Users create their own stories"
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own stories"
  ON public.stories FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and viewer can read story views"
  ON public.story_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Viewers record their own views"
  ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cleanup_expired_stories()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.stories WHERE expires_at < now() - interval '1 hour';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stories() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_stories() TO service_role;