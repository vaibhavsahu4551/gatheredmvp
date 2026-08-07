import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminAdjustPoints, adminGrantBadge, adminListPointsTx, adminPointsStats, adminSetRewardsConfig,
  adminTopReferrers, getRewardsConfig, type RewardsConfig,
} from "@/lib/rewards";
import { adminListUsers } from "@/lib/admin";

export const Route = createFileRoute("/admin/rewards")({
  ssr: false,
  component: AdminRewards,
});

type Tx = Awaited<ReturnType<typeof adminListPointsTx>>[number];

function AdminRewards() {
  const [cfg, setCfg] = useState<RewardsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ issued_this_month: 0, spent_this_month: 0, total_balance: 0 });
  const [top, setTop] = useState<{ user_id: string; full_name: string | null; referrals: number; points: number }[]>([]);
  const [tx, setTx] = useState<Tx[]>([]);
  const [kindFilter, setKindFilter] = useState("");

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [target, setTarget] = useState<{ id: string; full_name: string | null } | null>(null);
  const [amount, setAmount] = useState("50");
  const [reason, setReason] = useState("");
  const [badge, setBadge] = useState("Supporter");

  const loadAll = async () => {
    const [c, s, t, l] = await Promise.all([
      getRewardsConfig(), adminPointsStats(), adminTopReferrers(), adminListPointsTx({ kind: kindFilter, userId: target?.id }),
    ]);
    setCfg(c); setStats(s); setTop(t); setTx(l);
  };
  useEffect(() => { loadAll().catch((e) => toast.error(e.message)); }, []);
  useEffect(() => { adminListPointsTx({ kind: kindFilter, userId: target?.id }).then(setTx).catch(() => {}); }, [kindFilter, target?.id]);

  const doSearch = async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) { setUsers([]); return; }
    try {
      const rows = await adminListUsers(q.trim());
      setUsers((rows as any[]).slice(0, 8).map((r) => ({ id: r.id, full_name: r.full_name })));
    } catch { setUsers([]); }
  };

  const saveCfg = async () => {
    if (!cfg) return;
    setSaving(true);
    try { await adminSetRewardsConfig(cfg); toast.success("Reward settings saved"); await loadAll(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const adjust = async (sign: 1 | -1) => {
    if (!target) return toast.error("Pick a user first");
    const n = Math.abs(parseInt(amount || "0", 10));
    if (!n) return toast.error("Enter an amount");
    try {
      await adminAdjustPoints(target.id, sign * n, reason || (sign > 0 ? "Admin grant" : "Admin deduction"));
      toast.success("Points updated");
      setReason("");
      await loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const grantBadge = async () => {
    if (!target) return toast.error("Pick a user first");
    if (!badge.trim()) return toast.error("Enter a badge name");
    try { await adminGrantBadge(target.id, badge.trim(), reason || "Manual recognition"); toast.success("Badge granted"); }
    catch (e: any) { toast.error(e.message); }
  };

  const num = (k: keyof RewardsConfig, label: string) => (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        value={(cfg?.[k] as number) ?? 0}
        onChange={(e) => setCfg((c) => c ? { ...c, [k]: parseInt(e.target.value || "0", 10) } : c)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Rewards</h1>
        <p className="text-sm text-muted-foreground">Referral points, redemption costs and manual adjustments. Pride activity is excluded.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Issued this month", stats.issued_this_month], ["Spent this month", stats.spent_this_month], ["Total balance", stats.total_balance]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 text-xl font-bold">{v as number}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold">Point values</h2>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
          {num("referral_points", "Points per successful referral")}
          {num("welcome_points", "Welcome bonus for new user")}
          {num("cost_trial_days", "Cost — premium trial")}
          {num("trial_days", "Trial length (days)")}
          {num("cost_boost", "Cost — event boost")}
          {num("cost_badge", "Cost — profile badge")}
          <label className="block">
            <span className="text-xs text-muted-foreground">Badge name</span>
            <input
              value={cfg?.badge_name ?? ""}
              onChange={(e) => setCfg((c) => c ? { ...c, badge_name: e.target.value } : c)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button onClick={saveCfg} disabled={saving} className="mt-3 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Manual grant / deduct</h2>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <div>
            <input
              value={search}
              onChange={(e) => doSearch(e.target.value)}
              placeholder="Search user by name…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            {users.length > 0 && (
              <div className="mt-1 rounded-lg border border-border divide-y divide-border">
                {users.map((u) => (
                  <button key={u.id} onClick={() => { setTarget(u); setUsers([]); setSearch(u.full_name ?? ""); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {u.full_name ?? "Member"}
                  </button>
                ))}
              </div>
            )}
            {target && <div className="mt-2 text-xs text-muted-foreground">Selected: <span className="font-medium text-foreground">{target.full_name ?? target.id}</span></div>}
          </div>
          <div className="space-y-2">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (logged)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => adjust(1)} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">Grant</button>
              <button onClick={() => adjust(-1)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Deduct</button>
            </div>
            <div className="flex gap-2 pt-2">
              <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge name"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <button onClick={grantBadge} className="rounded-lg border border-border px-4 py-2 text-sm font-medium whitespace-nowrap">Grant badge</button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Top referrers</h2>
        {top.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No referrals yet.</p> : (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2">Member</th><th>Referrals</th><th>Points</th></tr></thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="py-2">{r.full_name ?? "Member"}</td><td>{r.referrals}</td><td>{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transactions</h2>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
            <option value="">All types</option>
            <option value="referral">Referral</option>
            <option value="welcome">Welcome</option>
            <option value="admin_adjust">Admin adjust</option>
            <option value="redeem_trial">Redeem trial</option>
            <option value="redeem_boost">Redeem boost</option>
            <option value="redeem_badge">Redeem badge</option>
          </select>
        </div>
        {tx.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No transactions.</p> : (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2">Member</th><th>Type</th><th>Amount</th><th>Reason</th><th>When</th></tr></thead>
            <tbody>
              {tx.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2">{t.full_name ?? "Member"}</td>
                  <td>{t.kind}</td>
                  <td className={t.amount >= 0 ? "text-primary" : ""}>{t.amount >= 0 ? "+" : ""}{t.amount}</td>
                  <td className="max-w-[220px] truncate">{t.reason}</td>
                  <td className="whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
