import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, MapPin, Clock } from "lucide-react";
import type { EventRow } from "@/lib/events";
import { SafetyMenu } from "@/components/SafetyMenu";
import { ShareButton } from "@/components/ShareToConnection";
import { eventTypeStyle } from "@/lib/event-style";
import { PremiumBadge } from "@/components/PremiumBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { NewHereBadge } from "@/components/NewHereBadge";

import { eventPhase } from "@/lib/event-status";
import { fallbackCover, isRemoteCover, signedEventCoverUrl } from "@/lib/event-cover";

export type EventCounts = { boys: number; girls: number; total: number };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function EventCard({
  e,
  c,
  host,
  hostPremium,
  hostVerified,
  hosting,
  prideHost,
}: {
  e: EventRow;
  c?: EventCounts;
  host?: { full_name: string | null; created_at?: string | null };
  hostPremium?: boolean;
  hostVerified?: boolean;
  /** True when the signed-in user hosts this event. */
  hosting?: boolean;
  /** When set (Pride surfaces), shown in place of the real host. */
  prideHost?: { display_name: string } | null;
}) {
  const counts = c ?? { boys: 0, girls: 0, total: 0 };
  const style = eventTypeStyle(e.event_type);
  const pride = !!(e as any).is_pride;
  const hostLabel = pride ? (prideHost?.display_name ?? "Pride member") : (host?.full_name ?? "Host");
  const phase = eventPhase(e as any, counts.total);
  const residence = ((e as any).venue_type ?? "public") === "residence";

  const isNew = !!(e as any).created_at && Date.now() - new Date((e as any).created_at).getTime() < WEEK_MS;
  const statusChip =
    phase === "closed" ? "Closed" :
    phase === "filling" ? "Trending" :
    isNew ? "New" : "Open";

  const cover = (e as any).cover_url as string | null | undefined;
  const [coverUrl, setCoverUrl] = useState(
    isRemoteCover(cover) ? cover! : fallbackCover(e.id, e.event_type),
  );
  useEffect(() => {
    let alive = true;
    if (cover && !isRemoteCover(cover)) {
      signedEventCoverUrl(cover).then((u) => { if (alive && u) setCoverUrl(u); });
    } else {
      setCoverUrl(isRemoteCover(cover) ? cover! : fallbackCover(e.id, e.event_type));
    }
    return () => { alive = false; };
  }, [cover, e.id, e.event_type]);

  const when = new Date(e.starts_at).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const ctaLabel = phase === "closed" ? "Closed" : phase === "filling" ? "Filling up" : "Join Now";

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: e.id }}
      className={`relative block overflow-hidden rounded-[20px] shadow-card transition active:scale-[0.99] ${phase === "closed" ? "opacity-75" : ""}`}
    >
      <div className="relative h-60 w-full">
        {/* Full-bleed cover */}
        <img
          src={coverUrl}
          alt={e.title}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover ${phase === "closed" ? "grayscale" : ""}`}
        />
        {/* Legibility gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15 pointer-events-none" />

        {/* Top-left badges */}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md ring-1 ring-white/25 ${
              phase === "closed"
                ? "bg-black/45 text-white/80"
                : "text-white"
            }`}
            style={phase === "closed" ? undefined : { backgroundImage: style.gradient }}
          >
            {statusChip}
          </span>
          {hosting && (
            <span className="rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              Hosting
            </span>
          )}
          {residence && (
            <span className="rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white px-2.5 py-1 text-[10px] font-semibold">
              Private residence
            </span>
          )}
          {(e as any).beginner_friendly && (
            <span className="rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white px-2.5 py-1 text-[10px] font-semibold">
              Beginner friendly
            </span>
          )}
        </div>

        {/* Top-right actions */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white">
          {!pride && <ShareButton kind="event" id={e.id} />}
          <SafetyMenu targetType="event" targetId={e.id} userId={pride ? undefined : e.host_id} />
        </div>

        {/* Bottom content over image */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          {e.event_type && (
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {e.event_type}
            </div>
          )}
          <h3 className="text-lg font-bold leading-snug tracking-tight text-white line-clamp-2">
            {e.title}
          </h3>

          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-white/85">
            <span className="flex items-center gap-1 min-w-0">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{when}</span>
            </span>
            <span className="flex items-center gap-1 min-w-0 flex-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{e.location_address}</span>
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-white/75 min-w-0 truncate">
              <span className="truncate">
                {hostLabel}
                {!pride && hostVerified && <VerifiedBadge />}
                {!pride && hostPremium && <PremiumBadge />}
                {!pride && <NewHereBadge createdAt={host?.created_at} className="ml-1" />}
              </span>
              <span className="opacity-60">·</span>
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {pride ? `${counts.total}/${e.max_size}` : `${counts.boys}B · ${counts.girls}G`}
              </span>
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-4 py-1.5 text-[12px] font-semibold shadow-md ${
                phase === "closed" ? "bg-white/20 text-white/70" : "text-white"
              }`}
              style={phase === "closed" ? undefined : { backgroundImage: style.gradient }}
            >
              {ctaLabel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
