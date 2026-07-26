import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminListUsers, suspendUser } from "@/lib/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  async function refresh() {
    setLoading(true);
    setRows(await adminListUsers(q));
    setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={refresh} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Search</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Events</th>
              <th className="px-3 py-2">Reports</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No users.</td></tr>}
            {rows.map((r) => {
              const suspended = r.suspended_until && new Date(r.suspended_until) > new Date();
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.full_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.phone ?? r.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 tabular-nums">{r.event_count}</td>
                  <td className="px-3 py-2 tabular-nums">{r.report_count > 0 ? <span className="text-destructive font-medium">{r.report_count}</span> : 0}</td>
                  <td className="px-3 py-2">
                    {suspended ? <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium">Suspended</span> : <span className="text-muted-foreground text-xs">Active</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setSelected(r)} className="text-xs underline">Manage</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <UserModal user={selected} onClose={() => setSelected(null)} onChanged={refresh} />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onChanged }: { user: any; onClose: () => void; onChanged: () => void }) {
  const [days, setDays] = useState<number>(7);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const suspended = user.suspended_until && new Date(user.suspended_until) > new Date();

  async function doSuspend() {
    setBusy(true);
    try {
      const until = new Date(Date.now() + days * 86400000).toISOString();
      await suspendUser(user.id, until, reason || null);
      toast.success(`Suspended for ${days} day(s)`);
      onChanged(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function doBan() {
    setBusy(true);
    try {
      await suspendUser(user.id, "9999-12-31T00:00:00Z", reason || "Permanent ban");
      toast.success("User banned");
      onChanged(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function doUnsuspend() {
    setBusy(true);
    try {
      await suspendUser(user.id, null, null);
      toast.success("Unsuspended");
      onChanged(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold">{user.full_name ?? "User"}</h2>
          <div className="text-xs text-muted-foreground">Joined {new Date(user.created_at).toLocaleDateString()} · {user.event_count} events · {user.report_count} reports</div>
        </div>
        <a href={`/u/${user.id}`} target="_blank" rel="noreferrer" className="inline-block text-xs underline">View public profile</a>
        {suspended && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs">
            Suspended until {new Date(user.suspended_until).toLocaleString()}
            {user.suspension_reason && <div className="text-muted-foreground mt-1">Reason: {user.suspension_reason}</div>}
          </div>
        )}
        <div className="space-y-2">
          <label className="block text-xs">Suspend for (days)
            <input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs">Reason (optional)
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={doSuspend} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Suspend</button>
          <button disabled={busy} onClick={doBan} className="rounded-lg bg-destructive text-destructive-foreground px-3 py-2 text-sm">Permanent ban</button>
          {suspended && <button disabled={busy} onClick={doUnsuspend} className="rounded-lg border border-border px-3 py-2 text-sm">Unsuspend</button>}
          <button onClick={onClose} className="ml-auto rounded-lg border border-border px-3 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
