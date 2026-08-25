import { supabase } from "@/integrations/supabase/client";
import { cached, invalidate, TTL } from "@/lib/cache";

export type WeeklyChallenge = {
  week_start: string;
  challenge_id: string;
  title: string;
  description: string | null;
  goal_type: string;
  goal_target: number;
  reward_kind: "badge" | "boost" | "trial" | string;
  reward_amount: number;
  badge_name: string | null;
  progress: number;
  completed: boolean;
};

/** This week's challenge + my progress. Cached for a few minutes. */
export function getWeeklyChallenge(): Promise<WeeklyChallenge | null> {
  return cached("challenge:week", TTL.medium, async () => {
    const { data, error } = await supabase.rpc("get_weekly_challenge" as any);
    if (error) throw error;
    const row = (data as any[])?.[0];
    return row ? (row as WeeklyChallenge) : null;
  });
}

export function invalidateWeeklyChallenge() {
  invalidate("challenge:week");
}

/** Grants the reward once progress has reached the goal. Returns a short reward description. */
export async function claimWeeklyChallenge(): Promise<string> {
  const { data, error } = await supabase.rpc("claim_weekly_challenge" as any);
  if (error) throw error;
  invalidateWeeklyChallenge();
  return (data as string) ?? "done";
}


export function rewardLabel(c: WeeklyChallenge) {
  if (c.reward_kind === "trial") return `${Math.max(c.reward_amount, 1)} days Premium`;
  if (c.reward_kind === "boost") return "Free event boost";
  return `${c.badge_name ?? "Badge"} badge`;
}
