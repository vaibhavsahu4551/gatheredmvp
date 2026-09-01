import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, CalendarDays, MapPin, Ticket } from "lucide-react";
import { priceLabel, resolveOfficialMedia, type OfficialEvent } from "@/lib/official-events";

function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString([], { day: "2-digit" }),
    mon: d.toLocaleDateString([], { month: "short" }).toUpperCase(),
    time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

/** Premium, image-led card for admin-curated official/partner events. */
export function OfficialEventCard({ e, compact }: { e: OfficialEvent; compact?: boolean }) {
  const [cover, setCover] = useState("");
  const [logo, setLogo] = useState("");
  useEffect(() => {
    let alive = true;
    resolveOfficialMedia(e.cover_url).then((u) => alive && setCover(u)).catch(() => {});
    resolveOfficialMedia(e.organizer_logo).then((u) => alive && setLogo(u)).catch(() => {});
    return () => { alive = false; };
  }, [e.cover_url, e.organizer_logo]);

  const d = dateParts(e.starts_at);

  return (
    <Link
      to="/official/$officialId"
      params={{ officialId: e.id }}
      className={`group block overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60 transition active:scale-[0.995] ${compact ? "w-[280px] shrink-0" : ""}`}
    >
      <div className="relative aspect-[16/10] w-full bg-muted">
        {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            <BadgeCheck className="h-3 w-3" /> Official Event
          </span>
          {e.is_pinned && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
              📌 Pinned
            </span>
          )}
          {e.is_featured && (
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950">
              Featured
            </span>
          )}
        </div>

        <div className="absolute right-3 top-3 rounded-2xl bg-background/95 px-2.5 py-1.5 text-center shadow-sm">
          <div className="text-[15px] font-extrabold leading-none tabular-nums">{d.day}</div>
          <div className="text-[10px] font-bold tracking-wide text-muted-foreground">{d.mon}</div>
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{e.category}</div>
          <h3 className="mt-0.5 line-clamp-2 text-[19px] font-extrabold leading-tight tracking-tight text-white">
            {e.title}
          </h3>
        </div>
      </div>

      <div className="space-y-2 p-3.5">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{d.time}</span>
          <span className="opacity-50">·</span>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{[e.venue, e.city].filter(Boolean).join(", ")}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {logo ? (
              <img src={logo} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                {(e.organizer_name || "G").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold">{e.organizer_name || "Gathr Partner"}</div>
              <div className="text-[10px] text-muted-foreground">Organizer</div>
            </div>
          </div>
          {priceLabel(e) && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">
              <Ticket className="h-3 w-3" /> {priceLabel(e)}
            </span>
          )}
        </div>

        <div className="flex w-full items-center justify-center rounded-full bg-gradient-brand py-2.5 text-[13px] font-bold text-white shadow-sm transition group-active:scale-[0.99]">
          Get Pass
        </div>
      </div>
    </Link>
  );
}
