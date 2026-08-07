import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

export type RewardsConfig = {
  referral_points: number;
  welcome_points: number;
  cost_trial_days: number;
  trial_days: number;
  cost_boost: number;
  cost_badge: number;
  badge_name: string;
};

export type MyRewards = {
  points: number;
  referral_code: string | null;
  referred_by: string | null;
  referral_count: number;
};

export type PointsTx = {
  id: string;
  kind: string;
  amount: number;
  reason: string | null;
  created_at: string;
};

const REF_KEY = "gathr_ref_code";

export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref");
  if (code) {
    try { localStorage.setItem(REF_KEY, code.trim().toUpperCase()); } catch { /* ignore */ }
  }
}

export function pendingReferralCode(): string | null {
  try { return localStorage.getItem(REF_KEY); } catch { return null; }
}

/** Attach a pending referral code to the signed-in user (before onboarding completes). */
export async function claimPendingReferral() {
  const code = pendingReferralCode();
  if (!code) return;
  try {
    await sb.rpc("claim_referral", { _code: code });
  } finally {
    try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ }
  }
}

export async function getRewardsConfig(): Promise<RewardsConfig> {
  const { data } = await sb.from("rewards_config").select("*").eq("id", 1).maybeSingle();
  return (data ?? {
    referral_points: 100, welcome_points: 25, cost_trial_days: 300,
    trial_days: 7, cost_boost: 150, cost_badge: 200, badge_name: "Supporter",
  }) as RewardsConfig;
}

export async function getMyRewards(): Promise<MyRewards> {
  const { data } = await sb.rpc("get_my_rewards");
  const row = Array.isArray(data) ? data[0] : data;
  return {
    points: row?.points ?? 0,
    referral_code: row?.referral_code ?? null,
    referred_by: row?.referred_by ?? null,
    referral_count: row?.referral_count ?? 0,
  };
}

export async function listMyPointsTx(): Promise<PointsTx[]> {
  const { data } = await sb
    .from("points_transactions")
    .select("id, kind, amount, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as PointsTx[];
}

export async function listMyBadges(): Promise<{ badge: string; created_at: string }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await sb.from("user_badges").select("badge, created_at").eq("user_id", user.id);
  return data ?? [];
}

export async function redeemReward(kind: "trial" | "boost" | "badge") {
  const { error } = await sb.rpc("redeem_reward", { _kind: kind });
  if (error) throw new Error(error.message);
}

export function referralLink(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://gatheredmvp.lovable.app";
  return `${origin}/auth?ref=${code}`;
}

/* ---------- admin ---------- */

export async function adminSetRewardsConfig(c: RewardsConfig) {
  const { error } = await sb.rpc("admin_set_rewards_config", {
    _referral_points: c.referral_points,
    _welcome_points: c.welcome_points,
    _cost_trial_days: c.cost_trial_days,
    _trial_days: c.trial_days,
    _cost_boost: c.cost_boost,
    _cost_badge: c.cost_badge,
    _badge_name: c.badge_name,
  });
  if (error) throw new Error(error.message);
}

export async function adminAdjustPoints(userId: string, amount: number, reason: string) {
  const { error } = await sb.rpc("admin_adjust_points", { _user: userId, _amount: amount, _reason: reason });
  if (error) throw new Error(error.message);
}

export async function adminGrantBadge(userId: string, badge: string, reason: string) {
  const { error } = await sb.rpc("admin_grant_badge", { _user: userId, _badge: badge, _reason: reason });
  if (error) throw new Error(error.message);
}

export async function adminTopReferrers() {
  const { data } = await sb.rpc("admin_top_referrers", { _limit: 20 });
  return (data ?? []) as { user_id: string; full_name: string | null; referrals: number; points: number }[];
}

export async function adminPointsStats() {
  const { data } = await sb.rpc("admin_points_stats");
  const row = Array.isArray(data) ? data[0] : data;
  return {
    issued_this_month: row?.issued_this_month ?? 0,
    spent_this_month: row?.spent_this_month ?? 0,
    total_balance: row?.total_balance ?? 0,
  };
}

export async function adminListPointsTx(filters: { userId?: string; kind?: string }) {
  const { data } = await sb.rpc("admin_list_points_tx", {
    _user: filters.userId || null,
    _kind: filters.kind || null,
    _limit: 200,
  });
  return (data ?? []) as {
    id: string; user_id: string; full_name: string | null;
    kind: string; amount: number; reason: string | null; created_at: string;
  }[];
}
