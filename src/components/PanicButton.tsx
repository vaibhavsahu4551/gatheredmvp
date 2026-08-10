import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert, X, LogOut, Ban, Flag } from "lucide-react";
import { toast } from "sonner";
import { leaveEvent } from "@/lib/events";
import { blockUser, submitReport, REPORT_REASONS, type ReportReason } from "@/lib/safety";

/**
 * Quick-exit / panic control for Pride event pages and Pride chat threads.
 * One tap opens three immediate actions — no long confirmation chains.
 */
export function PanicButton({ eventId, otherUserId }: { eventId: string; otherUserId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const exit = () => navigate({ to: "/pride", replace: true });

  const justLeave = async () => {
    setBusy(true);
    try { await leaveEvent(eventId); } catch { /* not a participant */ }
    exit();
  };

  const leaveAndBlock = async () => {
    setBusy(true);
    try {
      if (otherUserId) await blockUser(otherUserId);
      await leaveEvent(eventId).catch(() => {});
      toast.success("Done — this is private");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't complete that");
    }
    exit();
  };

  const sendReport = async () => {
    setBusy(true);
    try {
      await submitReport("event", eventId, reason, details);
      toast.success("Report sent anonymously");
      exit();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send report");
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick exit and safety options"
        className="h-9 w-9 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center"
      >
        <ShieldAlert className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Quick exit</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is private. Nobody is told that you left, reported, or blocked them.
            </p>

            {!reporting ? (
              <div className="space-y-2 pt-1">
                <button
                  disabled={busy}
                  onClick={leaveAndBlock}
                  className="w-full rounded-2xl bg-rose-500 text-white py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" /> Leave &amp; block
                </button>
                <button
                  disabled={busy}
                  onClick={() => setReporting(true)}
                  className="w-full rounded-2xl border border-border py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Flag className="h-4 w-4" /> Report
                </button>
                <button
                  disabled={busy}
                  onClick={justLeave}
                  className="w-full rounded-2xl bg-muted py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> Just leave
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Anything else we should know? (optional)"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
                <button
                  disabled={busy}
                  onClick={sendReport}
                  className="w-full rounded-2xl bg-gradient-brand text-white py-3.5 text-sm font-semibold disabled:opacity-50"
                >
                  Send report &amp; leave
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
