import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminCreatePass,
  adminDeletePass,
  adminUpdatePass,
  listPasses,
  passRemaining,
  type OfficialPass,
} from "@/lib/official-passes";

/** Admin-only editor for the pass tiers of one official event. */
export function PassManager({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<OfficialPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [desc, setDesc] = useState("");

  async function refresh() {
    setLoading(true);
    try { setRows(await listPasses(eventId)); }
    catch (e: any) { toast.error(e.message ?? "Couldn't load passes"); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [eventId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Pass name is required"); return; }
    try {
      await adminCreatePass(eventId, {
        name: name.trim(),
        description: desc.trim() || null,
        price: Number(price || 0),
        total_quantity: Number(qty || 0),
        active: true,
        sort_order: rows.length,
      });
      setName(""); setPrice(""); setQty(""); setDesc("");
      toast.success("Pass added");
      refresh();
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
      <div className="text-sm font-semibold">Passes / ticket tiers</div>
      {loading && <div className="py-3 text-xs text-muted-foreground">Loading…</div>}
      {!loading && rows.length === 0 && <div className="py-2 text-xs text-muted-foreground">No pass tiers yet.</div>}

      <div className="space-y-2 py-2">
        {rows.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2 text-xs">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.name} · ₹{Number(p.price).toLocaleString("en-IN")}</div>
              <div className="text-[11px] text-muted-foreground">
                {p.total_quantity > 0 ? `${passRemaining(p)} of ${p.total_quantity} left` : "Unlimited"} · sold {p.sold_quantity}
                {p.description ? ` · ${p.description}` : ""}
              </div>
            </div>
            <button className="underline" onClick={async () => {
              try { await adminUpdatePass(p.id, { active: !p.active }); refresh(); } catch (e: any) { toast.error(e.message); }
            }}>{p.active ? "Deactivate" : "Activate"}</button>
            <button className="text-destructive underline" onClick={async () => {
              if (!confirm(`Delete pass "${p.name}"?`)) return;
              try { await adminDeletePass(p.id); refresh(); } catch (e: any) { toast.error(e.message); }
            }}>Delete</button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pass name (e.g. Stag Male)"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Price ₹"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="Quantity (0 = unlimited)"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short note (optional)"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
        <button className="col-span-2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background sm:col-span-1">Add pass</button>
      </form>
    </div>
  );
}
