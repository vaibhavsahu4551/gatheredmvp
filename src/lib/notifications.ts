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

export const NOTIFICATIONS_PAGE = 20;

export async function listNotifications(
  opts: { pride?: boolean; limit?: number; offset?: number } = {},
): Promise<Notification[]> {
  const pride = opts.pride ?? false;
  const from = opts.offset ?? 0;
  const to = from + (opts.limit ?? NOTIFICATIONS_PAGE) - 1;
  const { data } = await sb.from("notifications")
    .select("*").eq("is_pride", pride).order("created_at", { ascending: false }).range(from, to);
  return (data ?? []) as Notification[];
}

export async function unreadCount(opts: { pride?: boolean } = {}): Promise<number> {
  const pride = opts.pride ?? false;
  const { count } = await sb.from("notifications")
    .select("id", { count: "exact", head: true }).is("read_at", null).eq("is_pride", pride);
  return count ?? 0;
}

export async function markAllRead(opts: { pride?: boolean } = {}) {
  const pride = opts.pride ?? false;
  await sb.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("is_pride", pride);
}
