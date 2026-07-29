import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminListReports, updateReportStatus, adminDeletePost, adminDeleteEvent, suspendUser, type AdminReport } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const [rows, setRows] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "actioned">("pending");
  const [open, setOpen] = useState<AdminReport | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await adminListReports());
    } catch (error) {
      console.error("Admin reports load failed", error);
      toast.error(error instanceof Error ? error.message : "Couldn't load reports");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  const filtered = rows.filter((r) => filter === "all" ? true : r.status === filter);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <div className="flex gap-2 text-sm">
        {(["pending","reviewed","actioned","all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 border ${filter === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && <div className="text-sm text-muted-foreground">No reports.</div>}
        {filtered.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 bg-background">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {r.is_pride_related
                    ? "A report was filed in the Pride section"
                    : <>Report on {r.target_type} · <span className="text-muted-foreground">{r.reason}</span></>}
                </div>
                {!r.is_pride_related && r.details && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.details}</div>}
                <div className="text-[11px] text-muted-foreground mt-1">
                  {new Date(r.created_at).toLocaleString()} · Status: <span className="capitalize">{r.status}</span>
                </div>
              </div>
              {r.is_pride_related ? (
                <button onClick={() => updateReportStatus(r.id, "reviewed").then(refresh)} className="text-xs underline whitespace-nowrap">
                  Route to manual review
                </button>
              ) : (
                <button onClick={() => setOpen(r)} className="text-xs underline whitespace-nowrap">Investigate</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && <ReportDrawer report={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  );
}

function ReportDrawer({ report, onClose, onChanged }: { report: AdminReport; onClose: () => void; onChanged: () => void }) {
  const [content, setContent] = useState<any>(null);
  const [messages, setMessages] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (report.target_type === "user") {
        const { data } = await (supabase as any).rpc("admin_get_user", { _user: report.target_id });
        setContent(Array.isArray(data) ? data[0] : data);
      } else if (report.target_type === "event") {
        const { data } = await supabase.from("events").select("*").eq("id", report.target_id).eq("is_pride", false).maybeSingle();
        setContent(data);
      } else if (report.target_type === "post") {
        const { data } = await supabase.from("posts").select("*").eq("id", report.target_id).maybeSingle();
        setContent(data);
      } else if (report.target_type === "message") {
        // Show the thread/group messages tied to the reported message id
        const { data: dm } = await supabase.from("dm_messages").select("*").eq("id", report.target_id).maybeSingle();
        if (dm) {
          const { data: thread } = await supabase.from("dm_messages").select("*").eq("thread_id", (dm as any).thread_id).order("created_at", { ascending: true }).limit(50);
          setContent(dm); setMessages(thread ?? []);
        } else {
          const { data: cm } = await supabase.from("chat_messages").select("*").eq("id", report.target_id).maybeSingle();
          if (cm) {
            const { data: group } = await supabase.from("chat_messages").select("*").eq("group_id", (cm as any).group_id).order("created_at", { ascending: true }).limit(50);
            setContent(cm); setMessages(group ?? []);
          }
        }
      }
    })();
  }, [report]);

  async function markStatus(status: "reviewed" | "actioned", notes?: string) {
    setBusy(true);
    try { await updateReportStatus(report.id, status, notes); toast.success("Updated"); onChanged(); onClose(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function removeContent() {
    if (!confirm("Remove this content?")) return;
    setBusy(true);
    try {
      if (report.target_type === "post") await adminDeletePost(report.target_id);
      else if (report.target_type === "event") await adminDeleteEvent(report.target_id);
      await updateReportStatus(report.id, "actioned", "Content removed");
      toast.success("Content removed");
      onChanged(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function warnUser() {
    if (report.target_type !== "user") return;
    setBusy(true);
    try {
      await suspendUser(report.target_id, new Date(Date.now() + 3 * 86400000).toISOString(), `Report: ${report.reason}`);
      await updateReportStatus(report.id, "actioned", "User suspended 3 days");
      toast.success("User suspended for 3 days");
      onChanged(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl bg-card border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold">Investigation</h2>
          <div className="text-xs text-muted-foreground">Report {report.id.slice(0, 8)} · {report.reason}</div>
          {report.details && <div className="text-xs mt-1">{report.details}</div>}
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/30 text-xs">
          <div className="font-medium mb-1">Reported content ({report.target_type})</div>
          {!content && <div className="text-muted-foreground">Not found or already removed.</div>}
          {content && <pre className="whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(content, null, 2)}</pre>}
          {messages && (
            <div className="mt-3 space-y-1">
              <div className="font-medium">Conversation context</div>
              {messages.map((m) => (
                <div key={m.id} className={`rounded p-2 ${m.id === report.target_id ? "bg-destructive/10 border border-destructive/30" : "bg-background"}`}>
                  <div className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()} · {m.user_id?.slice(0, 8)}</div>
                  <div>{m.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(report.target_type === "post" || report.target_type === "event") && (
            <button disabled={busy} onClick={removeContent} className="rounded-lg bg-destructive text-destructive-foreground px-3 py-2 text-sm">Remove content</button>
          )}
          {report.target_type === "user" && (
            <button disabled={busy} onClick={warnUser} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Suspend user 3d</button>
          )}
          <button disabled={busy} onClick={() => markStatus("reviewed")} className="rounded-lg border border-border px-3 py-2 text-sm">Mark reviewed</button>
          <button disabled={busy} onClick={() => markStatus("actioned")} className="rounded-lg border border-border px-3 py-2 text-sm">Mark actioned</button>
          <button onClick={onClose} className="ml-auto rounded-lg border border-border px-3 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
