import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminListEvents, adminDeleteEvent } from "@/lib/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
});

function AdminEvents() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await adminListEvents(q));
    } catch (error) {
      console.error("Admin events load failed", error);
      toast.error(error instanceof Error ? error.message : "Couldn't load events");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  async function remove(id: string, title: string) {
    if (!confirm(`Remove event "${title}"? This cannot be undone.`)) return;
    try { await adminDeleteEvent(id); toast.success("Event removed"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Events</h1>
      <p className="text-xs text-muted-foreground">Pride events are excluded from admin views.</p>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={refresh} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Search</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground text-left">
            <tr>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Host</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Attendees</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No events.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">{r.event_type ?? "—"} · {r.city ?? "—"}</div>
                </td>
                <td className="px-3 py-2">{r.host_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(r.starts_at).toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums">{r.attendees}/{r.max_size ?? "?"}</td>
                <td className="px-3 py-2 capitalize">{r.status}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  <a className="text-xs underline" href={`/events/${r.id}`} target="_blank" rel="noreferrer">Open</a>
                  <button onClick={() => remove(r.id, r.title)} className="text-xs text-destructive underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
