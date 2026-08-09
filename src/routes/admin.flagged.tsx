import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminListFlags, adminResolveFlag, signedImage, type AdminFlag } from "@/lib/admin-engagement";

export const Route = createFileRoute("/admin/flagged")({
  ssr: false,
  component: AdminFlagged,
});

const BUCKET_FOR: Record<string, string> = {
  post: "feed-photos",
  profile: "profile-photos",
  story: "stories",
  event: "feed-photos",
};

function FlagImage({ flag }: { flag: AdminFlag }) {
  const [url, setUrl] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    // Pride-origin uploads are never previewed — privacy guarantee.
    if (flag.is_pride || !flag.image_path) return;
    signedImage(BUCKET_FOR[flag.source] ?? "feed-photos", flag.image_path).then(setUrl);
  }, [flag]);

  if (flag.is_pride || !flag.image_path) {
    return <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center px-2">Preview withheld</div>;
  }
  if (!url) return <div className="h-24 w-24 rounded-lg bg-muted" />;
  return (
    <button onClick={() => setReveal((v) => !v)} className="relative h-24 w-24 rounded-lg overflow-hidden">
      <img src={url} alt="Flagged upload" className={`h-full w-full object-cover ${reveal ? "" : "blur-md"}`} />
      {!reveal && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white bg-black/40">Tap to reveal</span>}
    </button>
  );
}

function AdminFlagged() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<AdminFlag[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh(s = status) {
    setLoading(true);
    try { setRows(await adminListFlags(s)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(status); }, [status]);

  async function resolve(f: AdminFlag, action: "approved" | "confirmed", suspend?: number) {
    try {
      await adminResolveFlag(f.id, action, suspend);
      toast.success(action === "approved" ? "Restored" : "Removal confirmed");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Flagged content</h1>
        <p className="text-sm text-muted-foreground">
          Auto-moderation results. Pride-section uploads are listed without identity, image or event details.
        </p>
      </div>

      <div className="flex gap-2 text-sm">
        {["pending", "approved", "confirmed", "all"].map((f) => (
          <button key={f} onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1 border ${status === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && rows.length === 0 && <div className="text-sm text-muted-foreground">Nothing here.</div>}

      <div className="space-y-3">
        {rows.map((f) => (
          <div key={f.id} className="rounded-lg border border-border p-3 flex gap-3">
            <FlagImage flag={f} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {f.is_pride ? "A Pride-section upload was flagged" : (f.full_name ?? "Member")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {f.is_pride ? "Pride section" : `Source: ${f.source}`}
                {f.confidence != null && ` · confidence ${(f.confidence * 100).toFixed(0)}%`}
                {" · "}{new Date(f.created_at).toLocaleString()}
              </div>
              {!f.is_pride && f.reason && <div className="text-[11px] text-muted-foreground mt-1">{f.reason}</div>}
              {f.status === "pending" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => resolve(f, "approved")} className="rounded-lg border border-border px-3 py-1.5 text-xs">Approve (false positive)</button>
                  <button onClick={() => resolve(f, "confirmed")} className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs">Confirm removal</button>
                  <button onClick={() => confirm("Confirm removal and suspend this member for 7 days?") && resolve(f, "confirmed", 7)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-destructive">Confirm + suspend 7d</button>
                </div>
              )}
              {f.status !== "pending" && <div className="mt-2 text-[11px] capitalize text-muted-foreground">Resolved: {f.status}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
