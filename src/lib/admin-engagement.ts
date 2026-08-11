import { supabase } from "@/integrations/supabase/client";

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(fn, args ?? {});
  if (error) throw error;
  return data as T;
};

// ---------- Icebreakers ----------
export type AdminPrompt = {
  id: string; body: string; active: boolean; created_at: string; uses: number; last_used: string | null;
};
export const adminListPrompts = () => rpc<AdminPrompt[]>("admin_list_icebreaker_prompts");
export const adminUpsertPrompt = (id: string | null, body: string, active: boolean) =>
  rpc<string>("admin_upsert_icebreaker_prompt", { _id: id, _body: body, _active: active });
export const adminDeletePrompt = (id: string) => rpc<void>("admin_delete_icebreaker_prompt", { _id: id });
export const adminSetTodayPrompt = (id: string) => rpc<string>("admin_set_today_icebreaker", { _prompt: id });

export type PromptHistory = { day: string; prompt_id: string; body: string; responses: number };
export const adminPromptHistory = (limit = 30) => rpc<PromptHistory[]>("admin_icebreaker_history", { _limit: limit });

export type PromptResponse = { id: string; user_id: string; full_name: string | null; caption: string | null; created_at: string };
export const adminPromptResponses = (limit = 20) => rpc<PromptResponse[]>("admin_icebreaker_responses", { _day: null, _limit: limit });

// ---------- Weekly challenges ----------
export type AdminChallenge = {
  id: string; title: string; description: string | null; goal_type: string; goal_target: number;
  reward_kind: string; reward_amount: number; badge_name: string | null; active: boolean;
  created_at: string; times_used: number;
};
export const adminListChallenges = () => rpc<AdminChallenge[]>("admin_list_challenges");
export const adminUpsertChallenge = (c: Partial<AdminChallenge> & { id?: string | null }) =>
  rpc<string>("admin_upsert_challenge", {
    _id: c.id ?? null, _title: c.title, _description: c.description ?? null,
    _goal_type: c.goal_type, _goal_target: c.goal_target, _reward_kind: c.reward_kind,
    _reward_amount: c.reward_amount, _badge_name: c.badge_name ?? null, _active: c.active ?? true,
  });
export const adminDeleteChallenge = (id: string) => rpc<void>("admin_delete_challenge", { _id: id });
export const adminSetWeekChallenge = (id: string) => rpc<string>("admin_set_week_challenge", { _id: id });

export type ChallengeStats = {
  week_start: string; challenge_id: string; title: string; completions: number;
  badge_count: number; boost_count: number; trial_count: number;
};
export const adminChallengeStats = async () => (await rpc<ChallengeStats[]>("admin_challenge_stats"))?.[0] ?? null;

// ---------- Posts moderation ----------
export type AdminPost = {
  id: string; user_id: string; full_name: string | null; caption: string | null; photo_url: string | null;
  city: string | null; kind: string; created_at: string; likes: number; comments: number; reports: number;
};
export const adminListPosts = (search = "", limit = 100) =>
  rpc<AdminPost[]>("admin_list_posts", { _search: search, _limit: limit });
export const adminRemovePost = (id: string) => rpc<void>("admin_delete_post", { _id: id });

// ---------- Verification (live selfie vs profile photo) ----------
export type AdminVerification = {
  user_id: string; full_name: string | null; status: string; priority: boolean;
  rejection_reason: string | null; selfie_path: string | null; photos: string[] | null;
  submitted_at: string | null; updated_at: string; is_premium: boolean;
};
export const adminListVerification = (status = "pending") =>
  rpc<AdminVerification[]>("admin_list_verification", { _status: status });
export const adminSetVerification = (userId: string, status: "verified" | "rejected", reason?: string) =>
  rpc<void>("admin_set_verification", { _user: userId, _status: status, _reason: reason ?? null });


// ---------- Revenue ----------
export type RevenueStats = { active_premium: number; mrr: number; new_this_month: number; cancelled_this_month: number };
export const adminRevenueStats = async () =>
  (await rpc<RevenueStats[]>("admin_revenue_stats"))?.[0] ?? { active_premium: 0, mrr: 0, new_this_month: 0, cancelled_this_month: 0 };
export const adminSubscriberTrend = (days = 90) =>
  rpc<{ day: string; subscribers: number }[]>("admin_subscriber_trend", { _days: days });

// ---------- Flagged content ----------
export type AdminFlag = {
  id: string; user_id: string | null; full_name: string | null; source: string; is_pride: boolean;
  image_path: string | null; confidence: number | null; reason: string | null; status: string; created_at: string;
};
export const adminListFlags = (status = "pending") => rpc<AdminFlag[]>("admin_list_flags", { _status: status });
export const adminResolveFlag = (id: string, action: "approved" | "confirmed", suspendDays?: number) =>
  rpc<void>("admin_resolve_flag", { _id: id, _action: action, _suspend_days: suspendDays ?? null });

/** Signed URL for a non-Pride flagged/moderated image. */
export async function signedImage(bucket: string, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
