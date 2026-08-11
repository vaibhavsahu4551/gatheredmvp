import { Link } from "@tanstack/react-router";
import { ScanFace, X, Clock } from "lucide-react";

/**
 * Shown when an unverified member tries to join or create an event.
 * Browsing stays open — only these actions are gated.
 */
export function VerifyGatePrompt({
  open,
  action,
  status,
  reason,
  onClose,
}: {
  open: boolean;
  action: "join" | "create";
  status: "unverified" | "pending" | "rejected";
  reason?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  const pending = status === "pending";

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-background shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-sky-500 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {pending ? <Clock className="h-5 w-5" /> : <ScanFace className="h-5 w-5" />}
            <div className="text-sm font-semibold uppercase tracking-wider">Verification</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <h2 className="text-lg font-semibold">
            {pending
              ? "Verification in review"
              : `Verify your account to ${action === "join" ? "join" : "create"} events`}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {pending
              ? "We're reviewing your selfie — usually within 24 hours. You can browse in the meantime."
              : "Take a quick live selfie so we can match it to your profile photo. It keeps Gathr full of real people."}
          </p>
          {status === "rejected" && reason && (
            <p className="mt-3 rounded-xl bg-destructive/10 text-destructive text-xs px-3 py-2 leading-relaxed">
              Your last submission was rejected: {reason}
            </p>
          )}
          {!pending && (
            <Link
              to="/verify"
              onClick={onClose}
              className="mt-5 block w-full text-center rounded-full bg-sky-500 text-white py-3 text-sm font-semibold"
            >
              {status === "rejected" ? "Try again" : "Verify now"}
            </Link>
          )}
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-full border border-border py-2.5 text-sm font-medium text-muted-foreground"
          >
            {pending ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}
