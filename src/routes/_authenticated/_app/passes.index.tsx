import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Ticket } from "lucide-react";
import { myOrders, type OfficialOrder } from "@/lib/official-passes";
import { getOfficialEvent, type OfficialEvent } from "@/lib/official-events";

export const Route = createFileRoute("/_authenticated/_app/passes/")({
  head: () => ({
    meta: [
      { title: "My passes — Gathr" },
      { name: "description", content: "Track your Gathr official event passes, payment verification status and order history." },
      { property: "og:title", content: "My passes — Gathr" },
      { property: "og:description", content: "Your Gathr official event passes and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyPasses,
});

const statusChip: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "🟡 Verification pending", cls: "bg-amber-400/20 text-amber-700" },
  APPROVED: { label: "🟢 Confirmed", cls: "bg-green-500/20 text-green-700" },
  REJECTED: { label: "🔴 Rejected", cls: "bg-destructive/15 text-destructive" },
};

function MyPasses() {
  const [rows, setRows] = useState<OfficialOrder[]>([]);
  const [events, setEvents] = useState<Record<string, OfficialEvent>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    myOrders()
      .then(async (list) => {
        if (!alive) return;
        setRows(list);
        setLoading(false);
        const ids = [...new Set(list.map((o) => o.event_id))];
        const found = await Promise.all(ids.map((id) => getOfficialEvent(id).catch(() => null)));
        if (!alive) return;
        const map: Record<string, OfficialEvent> = {};
        found.forEach((e) => { if (e) map[e.id] = e; });
        setEvents(map);
      })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="pb-28">
      <div className="flex items-center gap-2 px-4 pb-2 pt-5">
        <Link to="/home" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-extrabold tracking-tight">My passes</h1>
      </div>

      <div className="space-y-3 px-5 pt-2">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Ticket className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No passes yet. Book one from an official event.</p>
          </div>
        )}
        {rows.map((o) => {
          const ev = events[o.event_id];
          const chip = statusChip[o.payment_status] ?? statusChip.PENDING;
          return (
            <Link
              key={o.id}
              to="/passes/$orderId"
              params={{ orderId: o.o.id }}
              className="block rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{ev?.title ?? "Official event"}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {o.pass_name} × {o.quantity} · ₹{Number(o.amount).toLocaleString("en-IN")}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${chip.cls}`}>{chip.label}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{o.order_code}</span>
                <span>UTR {o.utr}</span>
                <span>Ticket: {o.ticket_status}</span>
              </div>
              {o.admin_notes && <p className="mt-1 text-[11px] text-muted-foreground">Note: {o.admin_notes}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
