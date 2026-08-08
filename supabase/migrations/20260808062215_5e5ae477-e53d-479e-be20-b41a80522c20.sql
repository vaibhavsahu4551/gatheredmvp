
REVOKE EXECUTE ON FUNCTION public.roll_daily_icebreaker() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.announce_daily_icebreaker() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.roll_weekly_challenge() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_today_icebreaker() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_weekly_challenge() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_weekly_challenge() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_today_icebreaker() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_weekly_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.roll_daily_icebreaker() TO service_role;
GRANT EXECUTE ON FUNCTION public.announce_daily_icebreaker() TO service_role;
GRANT EXECUTE ON FUNCTION public.roll_weekly_challenge() TO service_role;
