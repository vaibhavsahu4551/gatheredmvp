import { useEffect, useRef, useState } from "react";
import { MoreVertical, Flag, Ban, X } from "lucide-react";
import { toast } from "sonner";
import {
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
  blockUser,
  submitReport,
} from "@/lib/safety";

type Props = {
  targetType: ReportTarget;
  targetId: string;
  /** For user reports/blocks. Required when target is a user; for events, pass the host id if you also want a Block option. */
  userId?: string;
  onBlocked?: () => void;
  className?: string;
};

export function SafetyMenu({ targetType, targetId, userId, onBlocked, className }: Props) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const doBlock = async () => {
    if (!userId) return;
    if (!confirm("Block this user? You won't see each other's posts, events, or comments.")) return;
    try {
      await blockUser(userId);
      toast.success("User blocked");
      setOpen(false);
      onBlocked?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not block");
    }
  };

  return (
    <div ref={ref} className={`relative inline-block ${className ?? ""}`}>
      <button
        type="button"
        aria-label="More"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-9 z-30 min-w-[160px] rounded-xl border border-border bg-popover shadow-lg p-1 text-sm"
        >
          <button
            onClick={(e) => { e.preventDefault(); setOpen(false); setReportOpen(true); }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted text-left"
          >
            <Flag className="h-4 w-4" /> Report
          </button>
          {userId && (
            <button
              onClick={(e) => { e.preventDefault(); doBlock(); }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted text-left text-red-600"
            >
              <Ban className="h-4 w-4" /> Block
            </button>
          )}
        </div>
      )}
      {reportOpen && (
        <ReportModal
          targetType={targetType}
          targetId={targetId}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

function ReportModal({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTarget;
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await submitReport(targetType, targetId, reason, details);
      toast.success("Thanks — our team will review.");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Could not send report");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-background border border-border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Report {targetType === "user" ? "user" : "event"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none"
              placeholder="Anything else we should know?"
            />
          </div>
          <button
            onClick={submit}
            disabled={sending}
            className="w-full rounded-full bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {sending ? "Sending…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
