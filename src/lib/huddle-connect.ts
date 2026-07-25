import { supabase } from "@/integrations/supabase/client";

export type HuddleStatus = "none" | "outgoing" | "incoming" | "connected" | "declined";

const sb: any = supabase;

export async function huddleStatusWith(otherId: string): Promise<{ status: HuddleStatus; requestId?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === otherId) return { status: "none" };
  const { data } = await sb.from("huddle_requests")
    .select("id, from_id, to_id, status")
    .or(`and(from_id.eq.${user.id},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${user.id})`)
    .maybeSingle();
  if (!data) return { status: "none" };
  if (data.status === "accepted") return { status: "connected", requestId: data.id };
  if (data.status === "declined") return { status: "declined", requestId: data.id };
  return { status: data.from_id === user.id ? "outgoing" : "incoming", requestId: data.id };
}

export async function sendHuddleRequest(toId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await sb.from("huddle_requests").insert({ from_id: user.id, to_id: toId });
  if (error) throw error;
}

export async function respondHuddleRequest(id: string, accept: boolean) {
  const { error } = await sb.from("huddle_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelHuddleRequest(id: string) {
  await sb.from("huddle_requests").delete().eq("id", id);
}

export async function listIncomingRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await sb.from("huddle_requests")
    .select("id, from_id, created_at, status")
    .eq("to_id", user.id).eq("status", "pending")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listOutgoingRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await sb.from("huddle_requests")
    .select("id, to_id, created_at, status")
    .eq("from_id", user.id).eq("status", "pending");
  return data ?? [];
}

export async function listConnections(userId: string): Promise<string[]> {
  const { data } = await sb.from("huddle_requests")
    .select("from_id, to_id, status")
    .eq("status", "accepted")
    .or(`from_id.eq.${userId},to_id.eq.${userId}`);
  return (data ?? []).map((r: any) => r.from_id === userId ? r.to_id : r.from_id);
}
