import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDmUnread } from "@/lib/dm";

export type UnreadMap = Record<string, { unread: number; last_body: string | null; last_sender: string | null; last_created_at: string | null }>;

export function useDmUnread() {
  const [map, setMap] = useState<UnreadMap>({});
  const [me, setMe] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const m = await getDmUnread();
    setMap(m);
  }, []);

  // Realtime fires per message; coalesce bursts into one refresh.
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { refresh().catch(() => {}); }, 800);
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    let channel: any;
    const onLocal = () => { refreshSoon(); };
    if (typeof window !== "undefined") window.addEventListener("dm-unread-refresh", onLocal);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      setMe(user.id);
      await refresh();
      channel = supabase.channel(`dm-unread-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, refreshSoon)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dm_threads" }, refreshSoon)
        .subscribe();
    })();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
      if (typeof window !== "undefined") window.removeEventListener("dm-unread-refresh", onLocal);
    };
  }, [refresh, refreshSoon]);


  const totalUnread = Object.values(map).reduce((n, v) => n + (v.unread || 0), 0);
  return { map, totalUnread, me, refresh };
}
