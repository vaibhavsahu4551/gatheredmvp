import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDmUnread } from "@/lib/dm";

export type UnreadMap = Record<string, { unread: number; last_body: string | null; last_sender: string | null; last_created_at: string | null }>;

export function useDmUnread() {
  const [map, setMap] = useState<UnreadMap>({});
  const [me, setMe] = useState<string | null>(null);
  const meRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const m = await getDmUnread();
    setMap(m);
  }, []);

  // Realtime can fire per message; reconcile shortly after the optimistic update.
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { refresh().catch(() => {}); }, 250);
  }, [refresh]);

  // Apply an incoming message to the local map immediately (no round-trip).
  const applyIncoming = useCallback((msg: any) => {
    const threadId = msg?.thread_id as string | undefined;
    if (!threadId) return;
    const mine = msg.sender_id === meRef.current;
    setMap((prev) => {
      const cur = prev[threadId] ?? { unread: 0, last_body: null, last_sender: null, last_created_at: null };
      return {
        ...prev,
        [threadId]: {
          unread: mine ? cur.unread : (cur.unread || 0) + 1,
          last_body: msg.body ?? (msg.voice_url ? "Voice note" : cur.last_body),
          last_sender: msg.sender_id ?? cur.last_sender,
          last_created_at: msg.created_at ?? new Date().toISOString(),
        },
      };
    });
    refreshSoon();
  }, [refreshSoon]);

  // Clear one thread's badge instantly when it is marked read.
  const clearThread = useCallback((threadId?: string) => {
    if (!threadId) return;
    setMap((prev) => (prev[threadId] ? { ...prev, [threadId]: { ...prev[threadId], unread: 0 } } : prev));
  }, []);

  useEffect(() => {
    let alive = true;
    let channel: any;
    const onLocal = (e: Event) => {
      clearThread((e as CustomEvent)?.detail?.threadId);
      refresh().catch(() => {});
    };
    const onFocus = () => { refresh().catch(() => {}); };
    if (typeof window !== "undefined") {
      window.addEventListener("dm-unread-refresh", onLocal as EventListener);
      window.addEventListener("focus", onFocus);
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      setMe(user.id);
      meRef.current = user.id;
      await refresh();
      channel = supabase.channel(`dm-unread-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" },
          (payload) => applyIncoming(payload.new))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dm_messages" }, refreshSoon)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "dm_messages" }, refreshSoon)
        // Read receipts live on the thread row; an update means counts changed.
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dm_threads" }, refreshSoon)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_threads" }, refreshSoon)
        .subscribe();
    })();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("dm-unread-refresh", onLocal as EventListener);
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [refresh, refreshSoon, applyIncoming, clearThread]);

  const totalUnread = Object.values(map).reduce((n, v) => n + (v.unread || 0), 0);
  return { map, totalUnread, me, refresh };
}
