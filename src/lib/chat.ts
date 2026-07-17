import { supabase } from "@/integrations/supabase/client";

export async function listMyGroups() {
  const { data: groups, error } = await supabase
    .from("chat_groups")
    .select("id, event_id, created_at, events(title, starts_at, status)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return groups ?? [];
}

export async function listMessages(groupId: string) {
  const { data, error } = await supabase.from("chat_messages")
    .select("*").eq("group_id", groupId).order("created_at", { ascending: true }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(groupId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await supabase.from("chat_messages").insert({ group_id: groupId, user_id: user.id, body });
  if (error) throw error;
}
