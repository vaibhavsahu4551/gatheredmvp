-- 1) Maintenance mode
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text;

-- 2) Music library
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  license text NOT NULL DEFAULT 'CC BY 4.0',
  attribution text,
  url text NOT NULL,
  storage_path text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.music_tracks TO authenticated;
GRANT ALL ON public.music_tracks TO service_role;
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read active tracks" ON public.music_tracks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tracks" ON public.music_tracks
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.music_tracks TO authenticated;

DROP TRIGGER IF EXISTS music_tracks_touch ON public.music_tracks;
CREATE TRIGGER music_tracks_touch BEFORE UPDATE ON public.music_tracks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Admin story moderation (Pride excluded)
CREATE OR REPLACE FUNCTION public.admin_list_stories(_search text DEFAULT '')
RETURNS TABLE (
  id uuid, user_id uuid, author_name text, media_path text, media_type text,
  text_overlay text, created_at timestamptz, expires_at timestamptz,
  views bigint, reports bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.user_id, p.full_name, s.media_path, s.media_type, s.text_overlay,
         s.created_at, s.expires_at,
         (SELECT count(*) FROM public.story_views v WHERE v.story_id = s.id),
         (SELECT count(*) FROM public.reports r WHERE r.target_type = 'story' AND r.target_id = s.id)
  FROM public.stories s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE private.has_role(auth.uid(), 'admin')
    AND s.is_pride = false
    AND s.expires_at > now()
    AND (_search = '' OR coalesce(p.full_name,'') ILIKE '%'||_search||'%' OR coalesce(s.text_overlay,'') ILIKE '%'||_search||'%')
  ORDER BY s.created_at DESC
  LIMIT 500
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_stories(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_stories(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_story(_story uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.stories WHERE id = _story AND is_pride = true) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM public.story_views WHERE story_id = _story;
  DELETE FROM public.stories WHERE id = _story;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_story(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_story(uuid) TO authenticated;

-- 4) Referral tracking
CREATE OR REPLACE FUNCTION public.admin_list_referrals(_search text DEFAULT '')
RETURNS TABLE (
  referrer_id uuid, referrer_name text, referred_id uuid, referred_name text,
  signed_up_at timestamptz, onboarded boolean, awarded_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.referred_by, rp.full_name, r.id, r.full_name, r.created_at,
         r.onboarding_complete, r.referral_awarded_at
  FROM public.profiles r
  JOIN public.profiles rp ON rp.id = r.referred_by
  WHERE private.has_role(auth.uid(), 'admin')
    AND r.referred_by IS NOT NULL
    AND (_search = '' OR coalesce(rp.full_name,'') ILIKE '%'||_search||'%' OR coalesce(r.full_name,'') ILIKE '%'||_search||'%')
  ORDER BY r.created_at DESC
  LIMIT 1000
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_referrals(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_referrals(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_referral_leaderboard(_scope text DEFAULT 'all')
RETURNS TABLE (user_id uuid, name text, referrals bigint, converted bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.referred_by, rp.full_name, count(*),
         count(*) FILTER (WHERE r.onboarding_complete)
  FROM public.profiles r
  JOIN public.profiles rp ON rp.id = r.referred_by
  WHERE private.has_role(auth.uid(), 'admin')
    AND r.referred_by IS NOT NULL
    AND (_scope <> 'month' OR r.created_at >= date_trunc('month', now()))
  GROUP BY r.referred_by, rp.full_name
  ORDER BY count(*) FILTER (WHERE r.onboarding_complete) DESC, count(*) DESC
  LIMIT 50
$$;
REVOKE EXECUTE ON FUNCTION public.admin_referral_leaderboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referral_leaderboard(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_referral_stats()
RETURNS TABLE (total bigint, converted bigint, this_month bigint, referrers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*),
         count(*) FILTER (WHERE onboarding_complete),
         count(*) FILTER (WHERE created_at >= date_trunc('month', now())),
         count(DISTINCT referred_by)
  FROM public.profiles
  WHERE private.has_role(auth.uid(), 'admin') AND referred_by IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.admin_referral_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referral_stats() TO authenticated;