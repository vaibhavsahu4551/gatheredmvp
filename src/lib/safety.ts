import { supabase } from "@/integrations/supabase/client";

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "inappropriate", label: "Inappropriate behavior" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Other" },
] as const;

export type ReportReason = typeof REPORT_REASONS[number]["value"];
export type ReportTarget = "user" | "event";

export async function submitReport(
  targetType: ReportTarget,
  targetId: string,
  reason: ReportReason,
  details?: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await supabase.from("reports" as any).insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details?.trim() || null,
  });
  if (error) throw error;
}

export async function blockUser(userId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  if (user.id === userId) throw new Error("You can't block yourself");
  const { error } = await supabase.from("blocks" as any).insert({
    blocker_id: user.id,
    blocked_id: userId,
  });
  if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;
}

export async function unblockUser(userId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("blocks" as any).delete().eq("blocker_id", user.id).eq("blocked_id", userId);
}

export async function loadBlockedIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from("blocks" as any).select("blocked_id").eq("blocker_id", user.id);
  return new Set((data ?? []).map((r: any) => r.blocked_id));
}
