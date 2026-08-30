import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarDays, ExternalLink, MapPin, MessageCircle, Ticket } from "lucide-react";
import {
  defaultBookingWhatsapp,
  getOfficialEvent,
  resolveOfficialMedia,
  whatsappBookingLink,
  type OfficialEvent,
} from "@/lib/official-events";

export const Route = createFileRoute("/_authenticated/_app/official/$officialId")({
  component: OfficialEventDetail,
});

function OfficialEventDetail() {
  const { officialId } = Route.useParams();
  const [e, setE] = useState<OfficialEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [cover, setCover] = useState("");
  const [logo, setLogo] = useState("");
  const [fallbackNum, setFallbackNum] = useState("");

  useEffect(() => {
    let alive = true;
    getOfficialEvent(officialId)
      .then(async (row) => {
        if (!alive) return;
        setE(row);
        setLoading(false);
        if (row) {
          resolveOfficialMedia(row.cover_url).then((u) => alive && setCover(u)).catch(() => {});
          resolveOfficialMedia(row.organizer_logo).then((u) => alive && setLogo(u)).catch(() => {});
        }
      })
      .catch(() => alive && setLoading(false));
    defaultBookingWhatsapp().then((n) => alive && setFallbackNum(n));
    return () => { alive = false; };
  }, [officialId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!e) return <div className="p-6 text-sm text-muted-foreground">This event is no longer available.</div>;

  const when = new Date(e.starts_at).toLocaleString([], {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  const wa = whatsappBookingLink(e, fallbackNum);

  return (
    <div className="pb-28">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
        <Link to="/home" className="absolute left-4 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute inset-x-4 bottom-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              <BadgeCheck className="h-3 w-3" /> Official Event
            </span>
            {e.is_featured && (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950">Featured</span>
            )}
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">{e.category}</span>
          </div>
          <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-white">{e.title}</h1>
        </div>
      </div>

      <div className="space-y-4 px-5 pt-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
          <Row icon={CalendarDays} label={when} />
          <Row icon={MapPin} label={[e.venue, e.city].filter(Boolean).join(", ") || "Venue TBA"} />
          {e.price_text && <Row icon={Ticket} label={e.price_text} />}
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          {logo ? (
            <img src={logo} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-bold">
              {(e.organizer_name || "G").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Organized by</div>
            <div className="truncate text-sm font-semibold">{e.organizer_name || "Gathr Partner"}</div>
          </div>
        </div>

        {e.description && (
          <section>
            <h2 className="text-sm font-semibold">About this event</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{e.description}</p>
          </section>
        )}

        {e.terms && (
          <section>
            <h2 className="text-sm font-semibold">Terms & information</h2>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{e.terms}</p>
          </section>
        )}

        {e.ticket_url && (
          <a
            href={e.ticket_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline"
          >
            Book tickets online <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {wa && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-[15px] font-bold text-white shadow-sm active:scale-[0.99]"
          >
            <MessageCircle className="h-5 w-5" /> Get Pass on WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
