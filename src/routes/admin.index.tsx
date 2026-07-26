import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

type Overview = {
  users: number;
  events: number;
  active: number;
  completed: number;
  signups: { day: string; count: number }[];
  types: { type: string; count: number }[];
};

function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date().toISOString();
      const [users, events, active, completed, signupsRes, typesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("is_pride", false),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("is_pride", false).in("status", ["pending", "confirmed"]).gte("starts_at", now),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("is_pride", false).lt("starts_at", now),
        supabase.from("profiles").select("created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("events").select("event_type").eq("is_pride", false),
      ]);

      const dayMap: Record<string, number> = {};
      for (const s of (signupsRes.data ?? []) as any[]) {
        const d = new Date(s.created_at).toISOString().slice(0, 10);
        dayMap[d] = (dayMap[d] ?? 0) + 1;
      }
      const signups = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
        return { day: d, count: dayMap[d] ?? 0 };
      });

      const typeMap: Record<string, number> = {};
      for (const e of (typesRes.data ?? []) as any[]) {
        const t = e.event_type ?? "Other";
        typeMap[t] = (typeMap[t] ?? 0) + 1;
      }
      const types = Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

      setData({
        users: users.count ?? 0,
        events: events.count ?? 0,
        active: active.count ?? 0,
        completed: completed.count ?? 0,
        signups, types,
      });
    })();
  }, []);

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const maxSignup = Math.max(1, ...data.signups.map((s) => s.count));
  const maxType = Math.max(1, ...data.types.map((t) => t.count));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total users" value={data.users} />
        <Stat label="Total events" value={data.events} />
        <Stat label="Active events" value={data.active} />
        <Stat label="Completed events" value={data.completed} />
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Signups (last 30 days)</h2>
        <div className="flex items-end gap-1 h-32 rounded-lg border border-border p-2 bg-muted/30">
          {data.signups.map((s) => (
            <div key={s.day} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${s.day}: ${s.count}`}>
              <div className="w-full rounded-t bg-foreground" style={{ height: `${(s.count / maxSignup) * 100}%`, minHeight: s.count ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{data.signups[0]?.day}</span><span>{data.signups[data.signups.length - 1]?.day}</span>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2">Events by type</h2>
        <div className="space-y-2">
          {data.types.length === 0 && <div className="text-xs text-muted-foreground">No events yet.</div>}
          {data.types.map((t) => (
            <div key={t.type} className="flex items-center gap-3 text-sm">
              <div className="w-24 text-muted-foreground">{t.type}</div>
              <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                <div className="h-full bg-foreground" style={{ width: `${(t.count / maxType) * 100}%` }} />
              </div>
              <div className="w-8 text-right tabular-nums">{t.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4 bg-background">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
