import { BadgeCheck } from "lucide-react";

/**
 * Face-match "Verified" badge — deliberately visually distinct from the
 * gradient Premium chip: a solid blue check mark, no text pill.
 */
export function VerifiedBadge({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      title="Verified — live selfie matched to profile photo"
      className={`inline-flex align-middle ${className}`}
    >
      <BadgeCheck
        aria-label="Verified member"
        style={{ width: size, height: size }}
        className="shrink-0 text-sky-500 fill-sky-500/15"
      />
    </span>
  );
}
