import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDmUnread } from "@/lib/dm";

export type UnreadMap = Record<string, { unread: number; last_body: string | null; last_sender: string | null; last_created_at: string | null }>;

export function useDmUnread() {
  const [map, setMap] = useState<UnreadMap>({});
  const [me, setMe] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const m = await getDmUnread();
    setMap(m);
  }, []);

  useEffect(() => {
    let alive = true;
    let channel: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      setMe(user.id);
      await refresh();
      channel = supabase.channel(`dm-unread-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, () => { refresh(); })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dm_threads" }, () => { refresh(); })
        .subscribe();
    })();
    return () => { alive = false; if (channel) supabase.removeChannel(channel); };
  }, [refresh]);

  const totalUnread = Object.values(map).reduce((n, v) => n + (v.unread || 0), 0);
  return { map, totalUnread, me, refresh };
}
