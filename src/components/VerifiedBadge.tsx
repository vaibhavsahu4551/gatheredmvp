import { BadgeCheck } from "lucide-react";

/**
 * Face-match "Verified" badge — deliberately visually distinct from the
 * gradient Premium chip: a solid blue check mark, no text pill.
 */
export function VerifiedBadge({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verified member"
      title="Verified — live selfie matched to profile photo"
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 align-middle text-sky-500 fill-sky-500/15 ${className}`}
    />
  );
}
