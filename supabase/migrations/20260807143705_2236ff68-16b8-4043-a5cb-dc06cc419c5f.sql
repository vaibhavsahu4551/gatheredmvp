ALTER FUNCTION private.gen_referral_code() SET search_path TO 'public';

REVOKE EXECUTE ON FUNCTION public.claim_referral(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_points(uuid, integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_grant_badge(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_rewards_config(integer, integer, integer, integer, integer, integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_referral_code() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.award_referral_on_onboarding() FROM anon, public;
REVOKE EXECUTE ON FUNCTION private.add_points(uuid, integer, text, text, uuid) FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_points(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_badge(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_rewards_config(integer, integer, integer, integer, integer, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_rewards() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_top_referrers(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_points_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_points_tx(uuid, text, integer) FROM anon;