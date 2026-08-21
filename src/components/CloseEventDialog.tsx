import { useState } from "react";
import { CircleSlash } from "lucide-react";

type Props = {
  open: boolean;
  attendeeCount: number;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function CloseEventDialog({ open, attendeeCount, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-5">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <CircleSlash className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-lg font-semibold">Close this Gathr?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {attendeeCount > 0
            ? `${attendeeCount} ${attendeeCount === 1 ? "person has" : "people have"} already joined — they'll be notified that it's off.`
            : "No new joins or messages will be allowed. The event stays visible."}
        </p>

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="Something came up — sorry folks!"
          className="mt-1 w-full rounded-2xl bg-background border border-border px-3.5 py-2.5 text-sm outline-none resize-none"
        />

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-border py-2.5 text-sm font-medium">
            Keep it open
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(reason); } finally { setBusy(false); }
            }}
            className="flex-1 rounded-full bg-foreground text-background py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Closing…" : "Close event"}
          </button>
        </div>
      </div>
    </div>
  );
}
