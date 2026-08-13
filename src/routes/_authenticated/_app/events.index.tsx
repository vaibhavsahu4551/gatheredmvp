import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";
import type { EventRow } from "@/lib/events";
import { EventCard, type EventCounts } from "@/components/EventCard";
import { sortEventsByStatus } from "@/lib/event-status";

export const Route = createFileRoute("/_authenticated/_app/events/")({
  component: Events,
});

function Events() {
  const [tab, setTab] = useState<"hosting" | "joined">("hosting");
  const [hosting, setHosting] = useState<EventRow[]>([]);
  const [joined, setJoined] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, EventCounts>>({});
  const [hosts, setHosts] = useState<Record<string, { full_name: string | null }>>({});
  const [hostTiers, setHostTiers] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: h } = await supabase
        .from("events")
        .select("*")
        .eq("host_id", user.id)
        .or("is_pride.is.null,is_pride.eq.false")
        .order("starts_at");
      setHosting((h ?? []) as EventRow[]);
      const { data: parts } = await supabase.from("event_participants").select("event_id").eq("user_id", user.id);
      const ids = (parts ?? []).map((p) => p.event_id);
      let js: EventRow[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from("events")
          .select("*")
          .in("id", ids)
          .or("is_pride.is.null,is_pride.eq.false")
          .order("starts_at");
        js = (data ?? []) as EventRow[];
        setJoined(js);
      }

      const all = [...(h ?? []), ...js] as EventRow[];
      const eventIds = all.map((e) => e.id);
      const hostIds = Array.from(new Set(all.map((e) => e.host_id)));

      if (hostIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, subscription_tier")
          .in("user_id", hostIds);
        const hmap: Record<string, { full_name: string | null }> = {};
        const tmap: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => {
          hmap[p.user_id] = { full_name: p.full_name };
          tmap[p.user_id] = p.subscription_tier ?? "free";
        });
        setHosts(hmap);
        setHostTiers(tmap);
      }

      if (eventIds.length) {
        const { data: allParts } = await supabase
          .from("event_participants")
          .select("event_id, user_id")
          .in("event_id", eventIds);
        const uids = Array.from(new Set((allParts ?? []).map((p: any) => p.user_id)));
        const genders: Record<string, string> = {};
        if (uids.length) {
          const { data: gp } = await supabase.from("profiles").select("user_id, gender").in("user_id", uids);
          (gp ?? []).forEach((p: any) => { genders[p.user_id] = p.gender ?? ""; });
        }
        const cmap: Record<string, EventCounts> = {};
        (allParts ?? []).forEach((p: any) => {
          const c = cmap[p.event_id] ?? { boys: 0, girls: 0, total: 0 };
          c.total += 1;
          const g = (genders[p.user_id] ?? "").toLowerCase();
          if (g === "male" || g === "man") c.boys += 1;
          else if (g === "female" || g === "woman") c.girls += 1;
          cmap[p.event_id] = c;
        });
        setCounts(cmap);
      }
    })();
  }, []);

  const list = sortEventsByStatus(tab === "hosting" ? hosting : joined, counts);
  return (
    <div>
      <header className="px-5 pt-8 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
      </header>
      <div className="px-5">
        <div className="inline-flex rounded-full border border-border p-0.5 text-sm">
          {(["hosting","joined"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full font-medium ${tab === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {t === "hosting" ? "Hosting" : "Joined"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 px-5 space-y-3 pb-6">
        {list.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Nothing here yet.</p>
          </div>
        )}
        {list.map((e) => (
          <EventCard
            key={e.id}
            e={e}
            c={counts[e.id]}
            host={hosts[e.host_id]}
            hostPremium={hostTiers[e.host_id] === "premium"}
          />
        ))}
      </div>
    </div>
  );
}
