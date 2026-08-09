import { Sparkles } from "lucide-react";
import { useSubscriptionsEnabled } from "@/hooks/useSubscriptionsEnabled";

/**
 * Small "Premium" badge shown next to a subscriber's name.
 * Hidden entirely while the admin subscription toggle is OFF.
 */
export function PremiumBadge({ size = 12, className = "" }: { size?: number; className?: string }) {
  const enabled = useSubscriptionsEnabled();
  if (!enabled) return null;
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
