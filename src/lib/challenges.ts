import { supabase } from "@/integrations/supabase/client";

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

export async function getWeeklyChallenge(): Promise<WeeklyChallenge | null> {
  const { data, error } = await supabase.rpc("get_weekly_challenge" as any);
  if (error) throw error;
  const row = (data as any[])?.[0];
  return row ? (row as WeeklyChallenge) : null;
}

/** Grants the reward once progress has reached the goal. Returns a short reward description. */
export async function claimWeeklyChallenge(): Promise<string> {
  const { data, error } = await supabase.rpc("claim_weekly_challenge" as any);
  if (error) throw error;
  return (data as string) ?? "done";
}

export function rewardLabel(c: WeeklyChallenge) {
  if (c.reward_kind === "trial") return `${Math.max(c.reward_amount, 1)} days Premium`;
  if (c.reward_kind === "boost") return "Free event boost";
  return `${c.badge_name ?? "Badge"} badge`;
}
