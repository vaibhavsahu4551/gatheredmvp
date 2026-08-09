import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminRevenueStats, adminSubscriberTrend, type RevenueStats } from "@/lib/admin-engagement";

export const Route = createFileRoute("/admin/revenue")({
  ssr: false,
  component: AdminRevenue,
});

function AdminRevenue() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [trend, setTrend] = useState<{ day: string; subscribers: number }[]>([]);

  useEffect(() => {
    Promise.all([adminRevenueStats(), adminSubscriberTrend(90)])
      .then(([s, t]) => { setStats(s); setTrend(t ?? []); })
      .catch((e) => toast.error(e.message));
  }, []);

  const max = Math.max(1, ...trend.map((t) => t.subscribers));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Revenue</h1>
        <p className="text-sm text-muted-foreground">Premium subscriptions at ₹199/month.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Active Premium", stats?.active_premium ?? 0],
          ["MRR", `₹${(stats?.mrr ?? 0).toLocaleString("en-IN")}`],
          ["New this month", stats?.new_this_month ?? 0],
          ["Cancelled this month", stats?.cancelled_this_month ?? 0],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 text-xl font-bold">{v as any}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold">Subscribers — last 90 days</h2>
        {trend.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No subscription history yet.</p>
        ) : (
          <div className="mt-3 flex items-end gap-[2px] h-40 rounded-xl border border-border p-3">
            {trend.map((t) => (
              <div key={t.day} title={`${t.day}: ${t.subscribers}`}
                className="flex-1 bg-foreground/70 rounded-t"
                style={{ height: `${(t.subscribers / max) * 100}%`, minHeight: 2 }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
