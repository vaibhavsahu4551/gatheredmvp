import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, MapPin, Clock } from "lucide-react";
import type { EventRow } from "@/lib/events";
import { SafetyMenu } from "@/components/SafetyMenu";
import { ShareButton } from "@/components/ShareToConnection";
import { eventTypeStyle } from "@/lib/event-style";
import { PremiumBadge } from "@/components/PremiumBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { eventPhase } from "@/lib/event-status";
import { fallbackCover, isRemoteCover, signedEventCoverUrl } from "@/lib/event-cover";

export type EventCounts = { boys: number; girls: number; total: number };

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
  host?: { full_name: string | null; created_at?: string | null };
  hostPremium?: boolean;
  hostVerified?: boolean;
  /** When set (Pride surfaces), shown in place of the real host. */
  prideHost?: { display_name: string } | null;
}) {
  const counts = c ?? { boys: 0, girls: 0, total: 0 };
  const style = eventTypeStyle(e.event_type);
  const pride = !!(e as any).is_pride;
  const hostLabel = pride ? (prideHost?.display_name ?? "Pride member") : (host?.full_name ?? "Host");
  const phase = eventPhase(e as any, counts.total);
  const residence = ((e as any).venue_type ?? "public") === "residence";


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
      className={`relative block rounded-3xl bg-card shadow-card transition active:scale-[0.995] overflow-hidden ${phase === "closed" ? "opacity-75" : ""}`}
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
            {phase === "closed" ? (
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">
                Closed
              </span>
            ) : phase === "filling" ? (
              <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
                Filling up
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                Open
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${residence ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}
            >
              {residence ? "Private residence" : "Public venue"}
            </span>
            {(e as any).beginner_friendly && (
              <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-semibold">
                Beginner friendly
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
              {!pride && <NewHereBadge createdAt={host?.created_at} className="ml-1" />}
            </span>

            <span className="opacity-60">·</span>
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {pride ? `${counts.total}/${e.max_size}` : `${counts.boys}B · ${counts.girls}G`}
            </span>
          </div>

          <div className="mt-2.5">
            <span
              className={`inline-flex items-center rounded-full px-4 py-1.5 text-[12px] font-semibold shadow-sm ${phase === "closed" ? "bg-muted text-muted-foreground" : "text-white"}`}
              style={phase === "closed" ? undefined : { backgroundImage: style.gradient }}
            >
              {ctaLabel}
            </span>
          </div>
        </div>

        {/* Right: cover thumbnail */}
        <div className="relative shrink-0" style={{ width: "38%", aspectRatio: "1 / 1" }}>
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover rounded-2xl ${phase === "closed" ? "grayscale" : ""}`}
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
