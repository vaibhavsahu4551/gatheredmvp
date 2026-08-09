import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminListVerification, adminSetVerification, type AdminVerification } from "@/lib/admin-engagement";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/verification")({
  ssr: false,
  component: AdminVerificationQueue,
});

function Shot({ bucket, path }: { bucket: string; path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (/^https?:/.test(path)) { setUrl(path); return; }
    supabase.storage.from(bucket).createSignedUrl(path, 300).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [bucket, path]);
  if (!url) return <div className="h-20 w-20 rounded-lg bg-muted" />;
  return <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />;
}

function AdminVerificationQueue() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<AdminVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<Record<string, string>>({});

  async function refresh(s = status) {
    setLoading(true);
    try { setRows(await adminListVerification(s)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(status); }, [status]);

  async function act(userId: string, next: "verified" | "unverified") {
    try {
      await adminSetVerification(userId, next, next === "unverified" ? reason[userId] : undefined);
      toast.success(next === "verified" ? "Approved" : "Rejected");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Verification</h1>
        <p className="text-sm text-muted-foreground">Premium / priority members appear first.</p>
      </div>

      <div className="flex gap-2 text-sm">
        {["pending", "verified", "unverified", "all"].map((f) => (
          <button key={f} onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1 border ${status === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && rows.length === 0 && <div className="text-sm text-muted-foreground">Queue is empty.</div>}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.user_id} className="rounded-lg border border-border p-3">
            <div className="flex items-start gap-3">
              {r.selfie_url ? <Shot bucket="selfies" path={r.selfie_url} />
                : r.photos?.[0] ? <Shot bucket="profile-photos" path={r.photos[0]} />
                : <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">No submission</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium truncate">{r.full_name ?? "Member"}</div>
                  {r.priority && <span className="text-[10px] rounded-full bg-gradient-brand text-white px-2 py-0.5">Priority</span>}
                  <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 capitalize">{r.status}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Updated {new Date(r.updated_at).toLocaleString()}</div>
                {r.rejection_reason && <div className="text-[11px] text-destructive mt-1">Rejected: {r.rejection_reason}</div>}
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <button onClick={() => act(r.user_id, "verified")} className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs">Approve</button>
                  <input value={reason[r.user_id] ?? ""} onChange={(e) => setReason({ ...reason, [r.user_id]: e.target.value })}
                    placeholder="Rejection reason" className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs flex-1 min-w-[160px]" />
                  <button onClick={() => act(r.user_id, "unverified")} className="rounded-lg border border-border px-3 py-1.5 text-xs text-destructive">Reject</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
