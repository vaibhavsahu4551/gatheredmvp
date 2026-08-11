import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminListVerification, adminSetVerification, type AdminVerification } from "@/lib/admin-engagement";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/verification")({
  ssr: false,
  component: AdminVerificationQueue,
});

function Shot({ bucket, path, label }: { bucket: string; path: string | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    if (/^https?:/.test(path)) { setUrl(path); return; }
    supabase.storage.from(bucket).createSignedUrl(path, 600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [bucket, path]);
  return (
    <div className="flex-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {url ? (
        <img src={url} alt={label} className="w-full aspect-square rounded-lg object-cover bg-muted" />
      ) : (
        <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center px-2">
          {path ? "Loading…" : "None submitted"}
        </div>
      )}
    </div>
  );
}

const FILTERS = ["pending", "verified", "rejected", "unverified", "all"] as const;

function AdminVerificationQueue() {
  const [status, setStatus] = useState<string>("pending");
  const [rows, setRows] = useState<AdminVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<Record<string, string>>({});

  async function refresh(s = status) {
    setLoading(true);
    try { setRows(await adminListVerification(s)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(status); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  async function act(userId: string, next: "verified" | "rejected") {
    if (next === "rejected" && !(reason[userId] ?? "").trim()) {
      toast.error("Add a rejection reason — the member sees it.");
      return;
    }
    try {
      await adminSetVerification(userId, next, next === "rejected" ? reason[userId] : undefined);
      toast.success(next === "verified" ? "Approved" : "Rejected");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  const statusChip = (s: string) =>
    s === "verified" ? "bg-sky-500/15 text-sky-600"
      : s === "pending" ? "bg-amber-500/15 text-amber-600"
      : s === "rejected" ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Verification</h1>
        <p className="text-sm text-muted-foreground">
          Compare the live selfie against the profile photo. Premium members appear first.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1 border capitalize ${status === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
            {f === "unverified" ? "not verified" : f}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && rows.length === 0 && <div className="text-sm text-muted-foreground">Nothing here.</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.user_id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-medium truncate">{r.full_name ?? "Member"}</div>
              {r.is_premium && <span className="text-[10px] rounded-full bg-gradient-brand text-white px-2 py-0.5">Premium</span>}
              <span className={`text-[10px] rounded-full px-2 py-0.5 capitalize ${statusChip(r.status)}`}>
                {r.status === "unverified" ? "not verified" : r.status}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {r.submitted_at ? `Submitted ${new Date(r.submitted_at).toLocaleString()}` : `Updated ${new Date(r.updated_at).toLocaleString()}`}
            </div>
            {r.rejection_reason && (
              <div className="text-[11px] text-destructive mt-1">Rejected: {r.rejection_reason}</div>
            )}

            <div className="mt-3 flex gap-2">
              <Shot bucket="profile-photos" path={r.photos?.[0] ?? null} label="Profile photo" />
              <Shot bucket="selfies" path={r.selfie_path} label="Live selfie" />
            </div>

            <div className="mt-3 space-y-2">
              <button onClick={() => act(r.user_id, "verified")}
                className="w-full rounded-lg bg-sky-500 text-white px-3 py-2 text-xs font-semibold">
                Approve
              </button>
              <div className="flex gap-2">
                <input value={reason[r.user_id] ?? ""} onChange={(e) => setReason({ ...reason, [r.user_id]: e.target.value })}
                  placeholder="Reason e.g. Photos don't match"
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs flex-1 min-w-0" />
                <button onClick={() => act(r.user_id, "rejected")}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-destructive shrink-0">Reject</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
