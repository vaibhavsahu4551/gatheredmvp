import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";

/**
 * Modal-style upgrade prompt shown when a free user hits a Premium limit.
 * Fail-open compatible — parent should skip mounting when hasPremiumAccess.
 */
export function UpgradePrompt({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-background shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-brand text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div className="text-sm font-semibold uppercase tracking-wider">Gathr Premium</div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{message}</p>
          <Link
            to="/premium"
            onClick={onClose}
            className="mt-5 block w-full text-center rounded-full bg-gradient-brand text-white py-3 text-sm font-semibold shadow-glow"
          >
            See Premium plans
          </Link>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-full border border-border py-2.5 text-sm font-medium text-muted-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
