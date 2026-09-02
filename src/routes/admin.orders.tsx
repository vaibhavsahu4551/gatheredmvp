import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminApproveOrder,
  adminListOrders,
  adminRejectOrder,
  adminSetTicketStatus,
  paymentProofUrl,
  type OfficialOrder,
  type PaymentStatus,
} from "@/lib/official-passes";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

const TABS: (PaymentStatus | "ALL")[] = ["PENDING", "APPROVED", "REJECTED", "ALL"];

function AdminOrders() {
  const [rows, setRows] = useState<OfficialOrder[]>([]);
  const [tab, setTab] = useState<PaymentStatus | "ALL">("PENDING");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh(status = tab, search = q) {
    setLoading(true);
    try { setRows(await adminListOrders({ status, q: search })); }
    catch (e: any) { toast.error(e.message ?? "Couldn't load orders"); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(tab, q); /* eslint-disable-next-line */ }, [tab]);

  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.payment_status === "PENDING").length,
    revenue: rows.filter((r) => r.payment_status === "APPROVED").reduce((s, r) => s + Number(r.amount), 0),
  };

  async function approve(o: OfficialOrder) {
    const notes = prompt("Optional note for this approval:") ?? undefined;
    try { await adminApproveOrder(o.id, notes); toast.success(`${o.order_code} approved — ticket is now active`); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function reject(o: OfficialOrder) {
    const notes = prompt("Reason for rejection (shown to the user):") ?? undefined;
    try { await adminRejectOrder(o.id, notes); toast.success(`${o.order_code} rejected`); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pass Orders</h1>
        <p className="text-xs text-muted-foreground">Manual UPI payments for official events. Approving an order activates the ticket.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Shown" value={stats.total} />
        <Stat label="Pending" value={stats.pending} />
        <Stat label="Approved ₹" value={`₹${stats.revenue.toLocaleString("en-IN")}`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-foreground text-background" : "border border-border"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order code, UTR or phone…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={() => refresh()} className="rounded-lg bg-foreground px-3 py-2 text-sm text-background">Search</button>
      </div>

      {loading && <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>}
      {!loading && rows.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No orders here.</div>}

      <div className="space-y-2">
        {rows.map((o) => <OrderRow key={o.id} o={o} onApprove={() => approve(o)} onReject={() => reject(o)}
          onTicket={async (s) => { try { await adminSetTicketStatus(o.id, s); toast.success("Ticket updated"); refresh(); } catch (e: any) { toast.error(e.message); } }} />)}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function OrderRow({ o, onApprove, onReject, onTicket }: {
  o: OfficialOrder;
  onApprove: () => void;
  onReject: () => void;
  onTicket: (s: "ACTIVE" | "USED" | "CANCELLED") => void;
}) {
  const [proof, setProof] = useState("");
  useEffect(() => { let a = true; paymentProofUrl(o.screenshot_path).then((u) => a && setProof(u)).catch(() => {}); return () => { a = false; }; }, [o.screenshot_path]);

  const tone = o.payment_status === "APPROVED" ? "bg-green-500/15 text-green-700"
    : o.payment_status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-amber-400/20 text-amber-700";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row">
      {proof ? (
        <a href={proof} target="_blank" rel="noreferrer" className="h-28 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
          <img src={proof} alt="Payment screenshot" className="h-full w-full object-cover" />
        </a>
      ) : (
        <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">No proof</div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{o.order_code}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{o.payment_status}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{o.ticket_status}</span>
        </div>
        <div className="text-[12px]">{o.pass_name} × {o.quantity} · <b>₹{Number(o.amount).toLocaleString("en-IN")}</b></div>
        <div className="text-[11px] text-muted-foreground">UTR: {o.utr}</div>
        <div className="text-[11px] text-muted-foreground">{o.customer_name} · {o.customer_phone}{o.customer_email ? ` · ${o.customer_email}` : ""}</div>
        <div className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
        {o.admin_notes && <div className="text-[11px] italic text-muted-foreground">Note: {o.admin_notes}</div>}
      </div>

      <div className="flex flex-wrap items-start gap-2 text-xs">
        {o.payment_status === "PENDING" && (
          <>
            <button onClick={onApprove} className="rounded-lg bg-green-600 px-3 py-1.5 font-semibold text-white">Approve</button>
            <button onClick={onReject} className="rounded-lg bg-destructive px-3 py-1.5 font-semibold text-white">Reject</button>
          </>
        )}
        {o.payment_status === "APPROVED" && o.ticket_status === "ACTIVE" && (
          <button onClick={() => onTicket("USED")} className="underline">Mark used</button>
        )}
        {o.payment_status === "APPROVED" && o.ticket_status !== "CANCELLED" && (
          <button onClick={() => onTicket("CANCELLED")} className="text-destructive underline">Cancel ticket</button>
        )}
      </div>
    </div>
  );
}
