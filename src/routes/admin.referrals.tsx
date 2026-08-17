import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminListReferrals, adminReferralLeaderboard, adminReferralStats,
  type AdminReferral, type ReferralLeader,
} from "@/lib/admin-content";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/referrals")({
  component: AdminReferrals,
});

function AdminReferrals() {
  const [rows, setRows] = useState<AdminReferral[]>([]);
  const [leaders, setLeaders] = useState<ReferralLeader[]>([]);
  const [scope, setScope] = useState<"month" | "all">("month");
  const [stats, setStats] = useState({ total: 0, converted: 0, thisMonth: 0, referrers: 0 });
  const [search, setSearch] = useState("");

  async function refresh(q = search, s = scope) {
    try {
      const [r, l, st] = await Promise.all([
        adminListReferrals(q), adminReferralLeaderboard(s), adminReferralStats(),
      ]);
      setRows(r); setLeaders(l); setStats(st);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh("", scope); }, [scope]);

  const rate = stats.total ? Math.round((stats.converted / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Referrals</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total referrals", value: stats.total },
          { label: "Converted", value: `${stats.converted} (${rate}%)` },
          { label: "This month", value: stats.thisMonth },
          { label: "Active referrers", value: stats.referrers },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border p-3">
            <div className="text-[11px] text-muted-foreground">{c.label}</div>
            <div className="text-lg font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <div className="flex gap-1 text-xs">
            {(["month", "all"] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`rounded-lg px-3 py-1.5 ${scope === s ? "bg-foreground text-background" : "bg-muted"}`}>
                {s === "month" ? "This month" : "All time"}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border divide-y divide-border">
          {leaders.map((l, i) => (
            <div key={l.user_id} className="flex items-center gap-3 p-3 text-sm">
              <span className="w-5 text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate">{l.name ?? "Unknown"}</span>
              <span className="text-muted-foreground text-xs">{l.converted} converted</span>
              <span className="font-medium">{l.referrals}</span>
            </div>
          ))}
          {leaders.length === 0 && <div className="p-3 text-xs text-muted-foreground">No referrals yet.</div>}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All referrals</h2>
          <form onSubmit={(e) => { e.preventDefault(); refresh(); }} className="flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name…"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Search</button>
          </form>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="p-2">Referrer</th><th className="p-2">Referred</th><th className="p-2">Signed up</th><th className="p-2">Onboarded</th><th className="p-2">Awarded</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.referrer_id}-${r.referred_id}`} className="border-t border-border">
                  <td className="p-2">{r.referrer_name ?? "—"}</td>
                  <td className="p-2">{r.referred_name ?? "—"}</td>
                  <td className="p-2">{new Date(r.signed_up_at).toLocaleDateString()}</td>
                  <td className="p-2">{r.onboarded ? "Yes" : "No"}</td>
                  <td className="p-2">{r.awarded_at ? new Date(r.awarded_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="p-3 text-xs text-muted-foreground">No rows.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
