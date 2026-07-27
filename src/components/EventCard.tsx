import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import type { EventRow } from "@/lib/events";
import { SafetyMenu } from "@/components/SafetyMenu";
import { ShareButton } from "@/components/ShareToConnection";
import { eventTypeStyle } from "@/lib/event-style";
import { PremiumBadge } from "@/components/PremiumBadge";

export type EventCounts = { boys: number; girls: number; total: number };

export function EventCard({
  e,
  c,
  host,
  hostPremium,
  prideHost,
}: {
  e: EventRow;
  c?: EventCounts;
  host?: { full_name: string | null };
  hostPremium?: boolean;
  /** When set (Pride surfaces), shown in place of the real host. */
  prideHost?: { display_name: string } | null;
}) {
  const counts = c ?? { boys: 0, girls: 0, total: 0 };
  const style = eventTypeStyle(e.event_type);
  const pride = !!(e as any).is_pride;
  const hostLabel = pride ? (prideHost?.display_name ?? "Pride member") : (host?.full_name ?? "Host");
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: e.id }}
      className="relative block overflow-hidden rounded-2xl bg-card shadow-card transition active:scale-[0.995]"
      style={{
        backgroundImage: style.tint,
        boxShadow: `0 1px 2px rgba(0,0,0,.04), 0 10px 28px -12px ${style.ring}55`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundImage: style.gradient }}
      />
      <div className="pl-4 pr-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {e.event_type && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm"
                style={{ backgroundImage: style.gradient, color: style.fg }}
              >
                {e.event_type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-[11px] text-muted-foreground">
              {new Date(e.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </span>
            {!pride && <ShareButton kind="event" id={e.id} />}
            {/* In Pride, never expose a report link keyed on the real host id. */}
            <SafetyMenu targetType="event" targetId={e.id} userId={pride ? undefined : e.host_id} />
          </div>
        </div>
        <h3 className="mt-1.5 text-[17px] font-semibold leading-snug">{e.title}</h3>
        <div className="mt-1 text-[13px] text-muted-foreground">{e.location_address}</div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{hostLabel}</span>
          {e.status === "confirmed" && (
            <span className="ml-auto rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">Confirmed</span>
          )}
          {e.status === "pending" && (
            <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">Filling up</span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {pride
              ? `${counts.total} joined · max ${e.max_size}`
              : `${counts.boys} boys, ${counts.girls} girls · max ${e.max_size}`}
          </div>
          <div
            className="rounded-full text-[13px] font-semibold px-4 py-1.5 text-white shadow-sm"
            style={{ backgroundImage: style.gradient }}
          >
            Open
          </div>
        </div>
      </div>
    </Link>
  );
}
