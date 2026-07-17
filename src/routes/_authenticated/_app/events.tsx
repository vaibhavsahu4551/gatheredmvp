import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";
import type { EventRow } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/_app/events")({
  component: Events,
});

function Events() {
  const [tab, setTab] = useState<"hosting" | "joined">("hosting");
  const [hosting, setHosting] = useState<EventRow[]>([]);
  const [joined, setJoined] = useState<EventRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: h } = await supabase.from("events").select("*").eq("host_id", user.id).order("starts_at");
      setHosting(h ?? []);
      const { data: parts } = await supabase.from("event_participants").select("event_id").eq("user_id", user.id);
      const ids = (parts ?? []).map((p) => p.event_id);
      if (ids.length) {
        const { data: js } = await supabase.from("events").select("*").in("id", ids).order("starts_at");
        setJoined(js ?? []);
      }
    })();
  }, []);

  const list = tab === "hosting" ? hosting : joined;
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
          <Link key={e.id} to="/events/$eventId" params={{ eventId: e.id }} className="block rounded-2xl border border-border p-4 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{e.category}</span>
              <span className="text-[11px] text-muted-foreground">{new Date(e.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <h3 className="mt-1.5 text-[16px] font-semibold">{e.title}</h3>
            <div className="mt-0.5 text-[12px] text-muted-foreground">{e.location_address}</div>
            <div className="mt-2 text-[11px]">
              <span className={`rounded-full px-2 py-0.5 font-medium ${e.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : e.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{e.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
