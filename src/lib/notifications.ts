import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

export type Notification = {
  id: string;
  user_id: string;
  kind: string;
  actor_id: string | null;
  target_id: string | null;
  data: any;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(): Promise<Notification[]> {
  const { data } = await sb.from("notifications")
    .select("*").order("created_at", { ascending: false }).limit(100);
  return (data ?? []) as Notification[];
}

export async function unreadCount(): Promise<number> {
  const { count } = await sb.from("notifications")
    .select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export async function markAllRead() {
  await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}
