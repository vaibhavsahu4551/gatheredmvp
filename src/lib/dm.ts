import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

function pair(a: string, b: string) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export async function getOrCreateThread(otherId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const p = pair(user.id, otherId);
  const { data: existing } = await sb.from("dm_threads")
    .select("id").eq("user_a", p.user_a).eq("user_b", p.user_b).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb.from("dm_threads").insert(p).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function listMyThreads() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await sb.from("dm_threads")
    .select("id, user_a, user_b, updated_at")
    .order("updated_at", { ascending: false });
  return (data ?? []).map((t: any) => ({
    id: t.id as string,
    other_id: (t.user_a === user.id ? t.user_b : t.user_a) as string,
    updated_at: t.updated_at as string,
  }));
}

export async function listDm(threadId: string) {
  const { data, error } = await sb.from("dm_messages")
    .select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function sendDm(threadId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await sb.from("dm_messages").insert({
    thread_id: threadId, sender_id: user.id, body: body.trim(),
  });
  if (error) throw error;
  await sb.from("dm_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
}

export async function shareToConnection(otherId: string, kind: "post" | "event", id: string, note?: string) {
  const threadId = await getOrCreateThread(otherId);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await sb.from("dm_messages").insert({
    thread_id: threadId, sender_id: user.id,
    body: note?.trim() || null, share_kind: kind, share_id: id,
  });
  if (error) throw error;
  await sb.from("dm_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
  return threadId;
}
