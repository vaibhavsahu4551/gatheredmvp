import { Link } from "@tanstack/react-router";
import { Users, MapPin, Clock } from "lucide-react";
import type { EventRow } from "@/lib/events";
import { SafetyMenu } from "@/components/SafetyMenu";
import { ShareButton } from "@/components/ShareToConnection";
import { eventTypeStyle } from "@/lib/event-style";
import { PremiumBadge } from "@/components/PremiumBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export type EventCounts = { boys: number; girls: number; total: number };

// Curated stock imagery per event type (Unsplash — no key needed).
const TYPE_IMAGE: Record<string, string> = {
  Breakfast: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=70",
  Lunch:     "https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=600&q=70",
  Dinner:    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=70",
  Drinks:    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=70",
  Club:      "https://images.unsplash.com/photo-1571266028243-e4bb35f9a1a1?auto=format&fit=crop&w=600&q=70",
  Gaming:    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=70",
  Movies:    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=70",
  Trek:      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=600&q=70",
  Other:     "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=70",
};

function coverFor(type?: string | null) {
  return TYPE_IMAGE[type ?? "Other"] ?? TYPE_IMAGE.Other;
}

export function EventCard({
  e,
  c,
  host,
  hostPremium,
  hostVerified,
  prideHost,
}: {
  e: EventRow;
  c?: EventCounts;
  host?: { full_name: string | null };
  hostPremium?: boolean;
  hostVerified?: boolean;
  /** When set (Pride surfaces), shown in place of the real host. */
  prideHost?: { display_name: string } | null;
}) {
  const counts = c ?? { boys: 0, girls: 0, total: 0 };
  const style = eventTypeStyle(e.event_type);
  const pride = !!(e as any).is_pride;
  const hostLabel = pride ? (prideHost?.display_name ?? "Pride member") : (host?.full_name ?? "Host");

  const when = new Date(e.starts_at).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const ctaLabel =
    e.status === "confirmed" ? "Open" : e.status === "pending" ? "Filling up" : "Join Now";

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: e.id }}
      className="relative block rounded-3xl bg-card shadow-card transition active:scale-[0.995] overflow-hidden"
    >
      <div className="flex gap-3 p-3">
        {/* Left: details */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1.5">
            {e.event_type && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm"
                style={{ backgroundImage: style.gradient, color: style.fg }}
              >
                {e.event_type}
              </span>
            )}
            {e.status === "confirmed" && (
              <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                Confirmed
              </span>
            )}
          </div>

          <h3 className="text-[17px] font-bold leading-snug tracking-tight line-clamp-2">
            {e.title}
          </h3>

          <div className="mt-1.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{when}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{e.location_address}</span>
          </div>

          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <span className="truncate">
              {hostLabel}
              {!pride && hostVerified && <VerifiedBadge />}
              {!pride && hostPremium && <PremiumBadge />}
            </span>
            <span className="opacity-60">·</span>
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {pride ? `${counts.total}/${e.max_size}` : `${counts.boys}B · ${counts.girls}G`}
            </span>
          </div>

          <div className="mt-2.5">
            <span
              className="inline-flex items-center rounded-full px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm"
              style={{ backgroundImage: style.gradient }}
            >
              {ctaLabel}
            </span>
          </div>
        </div>

        {/* Right: cover thumbnail */}
        <div className="relative shrink-0" style={{ width: "38%", aspectRatio: "1 / 1" }}>
          <img
            src={coverFor(e.event_type)}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover rounded-2xl"
          />
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ boxShadow: `inset 0 0 0 1px ${style.ring}22` }}
          />
          <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white">
            {!pride && <ShareButton kind="event" id={e.id} />}
            <SafetyMenu targetType="event" targetId={e.id} userId={pride ? undefined : e.host_id} />
          </div>
        </div>
      </div>
    </Link>
  );
}
