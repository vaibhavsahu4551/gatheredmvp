import { Sparkle } from "lucide-react";
import { isNewHere } from "@/lib/badges";

/**
 * "New here" chip — shown for members in their first 14 days.
 * Renders nothing when the member is past the window (or the date is unknown).
 */
export function NewHereBadge({ createdAt, className = "" }: { createdAt?: string | null; className?: string }) {
  if (!isNewHere(createdAt)) return null;
  return (
    <span
      title="Joined Gathr in the last 14 days"
      className={`inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide align-middle ${className}`}
    >
      <Sparkle className="h-2.5 w-2.5" />
      New here
    </span>
  );
}
