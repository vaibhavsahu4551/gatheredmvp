import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { myOrders, type OfficialOrder } from "@/lib/official-passes";
import { getOfficialEvent, type OfficialEvent } from "@/lib/official-events";

const chips: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-amber-400/20 text-amber-700" },
  APPROVED: { label: "Confirmed", cls: "bg-green-500/20 text-green-700" },
  REJECTED: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
};

/** Horizontal rail of the signed-in user's official event passes. Hidden when empty. */
export function MyPassesRail() {
  const [rows, setRows] = useState<OfficialOrder[]>([]);
  const [events, setEvents] = useState<Record<string, OfficialEvent>>({});

  useEffect(() => {
    let alive = true;
    myOrders()
      .then(async (list) => {
        if (!alive) return;
        setRows(list.slice(0, 10));
        const ids = [...new Set(list.slice(0, 10).map((o) => o.event_id))];
        const found = await Promise.all(ids.map((id) => getOfficialEvent(id).catch(() => null)));
        if (!alive) return;
        const map: Record<string, OfficialEvent> = {};
        found.forEach((e) => { if (e) map[e.id] = e; });
        setEvents(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!rows.length) return null;

  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <div className="text-sm font-semibold">🎟️ My passes</div>
          <div className="text-xs text-muted-foreground">Your booked official event passes</div>
        </div>
        <Link to="/passes" className="text-xs font-medium text-primary">See all</Link>
      </div>
      <div className="-mx-5 flex gap-3 overflow-x-auto snap-x px-5 pb-1">
        {rows.map((o) => {
          const ev = events[o.event_id];
          const chip = chips[o.payment_status] ?? chips.PENDING;
          const when = ev?.starts_at
            ? new Date(ev.starts_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
            : "";
          return (
            <Link
              key={o.id}
              to="/passes/$orderId"
              params={{ orderId: o.id }}
              className="w-[68%] shrink-0 snap-start rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="truncate text-sm font-bold">{ev?.title ?? "Official event"}</div>
              </div>
              {when && <div className="mt-1 text-[11px] text-muted-foreground">{when}</div>}
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>{chip.label}</span>
                <span className="truncate text-[11px] text-muted-foreground">{o.pass_name} × {o.quantity}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
