import { Award, BadgeCheck, Crown, Flame, Heart, Star, Trophy, Users, Zap, Sparkles } from "lucide-react";
import type { BadgeDef, EarnedBadge, FeaturedBadge } from "@/lib/badges";

const ICONS: Record<string, any> = {
  award: Award,
  star: Star,
  trophy: Trophy,
  flame: Flame,
  heart: Heart,
  users: Users,
  zap: Zap,
  crown: Crown,
  sparkles: Sparkles,
  "badge-check": BadgeCheck,
};

export function badgeIcon(name?: string) {
  return ICONS[(name ?? "award").toLowerCase()] ?? Award;
}

/** Compact chip row for the profile header (light text on dark hero). */
export function FeaturedBadgeRow({
  featured,
  extra,
  onMore,
}: {
  featured: FeaturedBadge[];
  extra: number;
  onMore?: () => void;
}) {
  if (featured.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {featured.map((b) => {
        const Icon =
          b.kind === "verified" ? BadgeCheck : b.kind === "premium" ? Crown : badgeIcon(b.icon);
        const tone =
          b.kind === "verified"
            ? "bg-sky-500/90 text-white"
            : b.kind === "premium"
              ? "bg-amber-400/90 text-amber-950"
              : "bg-white/20 text-white backdrop-blur";
        return (
          <span
            key={b.key}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
          >
            <Icon className="h-3 w-3" />
            {b.label}
          </span>
        );
      })}
      {extra > 0 && (
        <button
          type="button"
          onClick={onMore}
          className="rounded-full bg-white/20 backdrop-blur px-2 py-0.5 text-[11px] font-semibold text-white"
        >
          +{extra} more
        </button>
      )}
    </div>
  );
}

/** Full grid of earned badges for the Badges tab. */
export function BadgeGrid({
  earned,
  catalog,
  verified,
  premium,
}: {
  earned: EarnedBadge[];
  catalog: BadgeDef[];
  verified?: boolean;
  premium?: boolean;
}) {
  const byName = new Map(catalog.map((c) => [c.badge, c]));
  const cells: { key: string; label: string; desc: string | null; Icon: any; tone: string }[] = [];
  if (verified)
    cells.push({ key: "verified", label: "Verified", desc: "Selfie matched to profile photo", Icon: BadgeCheck, tone: "text-sky-600 bg-sky-50" });
  if (premium)
    cells.push({ key: "premium", label: "Premium", desc: "Gathr Premium member", Icon: Crown, tone: "text-amber-600 bg-amber-50" });
  for (const e of [...earned].sort(
    (a, b) => (byName.get(a.badge)?.priority ?? 999) - (byName.get(b.badge)?.priority ?? 999),
  )) {
    const def = byName.get(e.badge);
    cells.push({
      key: e.badge,
      label: def?.label ?? e.badge,
      desc: def?.description ?? e.reason,
      Icon: badgeIcon(def?.icon),
      tone: "text-primary bg-muted",
    });
  }

  if (cells.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border py-10 px-6 text-center text-sm text-muted-foreground">
        No badges yet. Host, join and connect to earn them.
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-3">
      {cells.map((c) => (
        <div key={c.key} className="rounded-2xl border border-border bg-card p-4">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${c.tone}`}>
            <c.Icon className="h-5 w-5" />
          </div>
          <div className="mt-3 text-sm font-semibold">{c.label}</div>
          {c.desc && <div className="mt-0.5 text-[12px] text-muted-foreground leading-snug">{c.desc}</div>}
        </div>
      ))}
    </div>
  );
}
