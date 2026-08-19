import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminListBadgeCatalog, adminUpsertBadge, type BadgeDef } from "@/lib/badges";
import { badgeIcon } from "@/components/BadgeChips";
import { ArrowDown, ArrowUp, Save } from "lucide-react";

export const Route = createFileRoute("/admin/badges")({
  ssr: false,
  component: AdminBadges,
});

type Row = BadgeDef & { awarded: number };

function AdminBadges() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminListBadgeCatalog();
      setRows([...data].sort((a, b) => a.priority - b.priority));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load badges");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next.map((r, idx) => ({ ...r, priority: idx + 1 })));
  };

  const patch = (i: number, p: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const save = async () => {
    setBusy(true);
    try {
      for (const r of rows) {
        await adminUpsertBadge({
          badge: r.badge,
          label: r.label,
          description: r.description,
          icon: r.icon,
          priority: r.priority,
          active: r.active,
        });
      }
      toast.success("Badge order saved");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Badges</h1>
          <p className="text-sm text-muted-foreground">
            Order decides the “Featured 3” on profiles (Verified &gt; Premium &gt; top achievements).
          </p>
        </div>
        <button
          onClick={save}
          disabled={busy || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Save
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No badges in the catalog.</div>
      ) : (
        <div className="mt-5 space-y-2">
          {rows.map((r, i) => {
            const Icon = badgeIcon(r.icon);
            return (
              <div key={r.badge} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} aria-label="Move up" className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => move(i, 1)} aria-label="Move down" className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={r.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    className="w-full bg-transparent text-sm font-medium outline-none"
                  />
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.badge} · {r.awarded} awarded
                  </div>
                </div>
                <input
                  value={r.icon}
                  onChange={(e) => patch(i, { icon: e.target.value })}
                  placeholder="icon"
                  className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
                <div className="w-12 text-center text-xs text-muted-foreground">#{r.priority}</div>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={r.active} onChange={(e) => patch(i, { active: e.target.checked })} />
                  Active
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
