import { Sparkles } from "lucide-react";

/** Small "Premium" badge shown next to a subscriber's name. */
export function PremiumBadge({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      title="Gathr Premium member"
      className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-brand text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-sm align-middle ${className}`}
    >
      <Sparkles style={{ width: size - 4, height: size - 4 }} />
      Premium
    </span>
  );
}
