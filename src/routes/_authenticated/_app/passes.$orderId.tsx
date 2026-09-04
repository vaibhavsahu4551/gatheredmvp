import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, MapPin, CalendarDays, Ticket } from "lucide-react";
import QRCode from "qrcode";
import { myOrder, type OfficialOrder } from "@/lib/official-passes";
import { getOfficialEvent, type OfficialEvent } from "@/lib/official-events";

export const Route = createFileRoute("/_authenticated/_app/passes/$orderId")({
  head: () => ({
    meta: [
      { title: "Your ticket — Gathr" },
      { name: "description", content: "View your Gathr official event ticket with QR code for check-in." },
      { property: "og:title", content: "Your ticket — Gathr" },
      { property: "og:description", content: "View your Gathr official event ticket with QR code for check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketDetail,
});

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

function TicketDetail() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OfficialOrder | null>(null);
  const [event, setEvent] = useState<OfficialEvent | null>(null);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    myOrder(orderId)
      .then(async (o) => {
        if (!alive) return;
        setOrder(o);
        setLoading(false);
        if (!o) return;
        getOfficialEvent(o.event_id).then((e) => alive && setEvent(e)).catch(() => {});
        if (o.ticket_status === "ACTIVE" && o.payment_status === "APPROVED") {
          const url = await QRCode.toDataURL(
            JSON.stringify({ t: o.order_code, o: o.id, e: o.event_id, q: o.quantity }),
            { width: 640, margin: 1, color: { dark: "#111111", light: "#ffffff" } },
          );
          if (alive) setQr(url);
        }
      })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [orderId]);

  const download = async () => {
    if (!order || !qr) return;
    const c = document.createElement("canvas");
    c.width = 900; c.height = 1350;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 64px sans-serif";
    ctx.fillText("Gathr", 60, 110);
    ctx.font = "bold 44px sans-serif";
    wrap(ctx, event?.title ?? "Official event", 60, 210, 780, 54);
    ctx.font = "30px sans-serif";
    ctx.fillStyle = "#444";
    ctx.fillText(`${order.pass_name} × ${order.quantity}`, 60, 340);
    ctx.fillText(fmtDate(event?.starts_at), 60, 390);
    ctx.fillText(`${event?.venue ?? ""}${event?.city ? ", " + event.city : ""}`.slice(0, 46), 60, 440);
    ctx.fillText(`Organizer: ${event?.organizer_name ?? "Gathr"}`, 60, 490);
    const img = new Image();
    img.src = qr;
    await new Promise((r) => { img.onload = r; });
    ctx.drawImage(img, 210, 550, 480, 480);
    ctx.fillStyle = "#111";
    ctx.font = "bold 40px monospace";
    ctx.fillText(order.order_code, 60, 1120);
    ctx.font = "26px sans-serif";
    ctx.fillStyle = "#666";
    ctx.fillText("Show this QR at check-in", 60, 1170);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `gathr-ticket-${order.order_code}.png`;
    a.click();
  };

  if (loading) return <div className="px-5 py-10 text-sm text-muted-foreground">Loading…</div>;

  if (!order) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-muted-foreground">Ticket not found.</p>
        <button onClick={() => navigate({ to: "/passes" })} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          Back to my passes
        </button>
      </div>
    );
  }

  const confirmed = order.payment_status === "APPROVED" && order.ticket_status === "ACTIVE";

  return (
    <div className="pb-28">
      <div className="flex items-center gap-2 px-4 pb-2 pt-5">
        <Link to="/passes" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-extrabold tracking-tight">Your ticket</h1>
      </div>

      <div className="px-5 pt-2">
        <div ref={cardRef} className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
          <div className="flex items-center justify-between px-5 pt-4">
            <span className="text-lg font-black tracking-tight">Gathr</span>
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px]">{order.order_code}</span>
          </div>

          {event?.cover_url && (
            <img src={event.cover_url} alt={`${event.title} cover`} loading="lazy" className="mt-3 h-40 w-full object-cover" />
          )}

          <div className="space-y-2 px-5 py-4">
            <h2 className="text-base font-extrabold leading-snug">{event?.title ?? "Official event"}</h2>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Ticket className="h-4 w-4" />
              {order.pass_name} × {order.quantity} · ₹{Number(order.amount).toLocaleString("en-IN")}
            </div>
            {event?.starts_at && (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <CalendarDays className="h-4 w-4" />{fmtDate(event.starts_at)}
              </div>
            )}
            {event?.venue && (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <MapPin className="h-4 w-4" />{event.venue}{event.city ? `, ${event.city}` : ""}
              </div>
            )}
            <div className="text-[13px] text-muted-foreground">Organizer: {event?.organizer_name || "Gathr"}</div>
          </div>

          <div className="border-t border-dashed border-border px-5 py-6 text-center">
            {confirmed ? (
              qr ? (
                <>
                  <img src={qr} alt={`QR code for ticket ${order.order_code}`} className="mx-auto h-52 w-52 rounded-xl bg-white p-2" />
                  <p className="mt-3 text-[12px] text-muted-foreground">Show this QR at check-in</p>
                  <p className="mt-1 font-mono text-sm font-bold">{order.order_code}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Generating QR…</p>
              )
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  {order.payment_status === "PENDING" && "🟡 Payment verification pending"}
                  {order.payment_status === "REJECTED" && "🔴 Payment rejected"}
                  {order.payment_status === "APPROVED" && `Ticket status: ${order.ticket_status}`}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {order.payment_status === "PENDING"
                    ? "Your QR ticket appears here once our team verifies your UPI payment."
                    : order.payment_status === "REJECTED"
                      ? "This order was rejected, so no ticket was issued."
                      : "No QR available for this ticket status."}
                </p>
                {order.admin_notes && <p className="text-[12px] text-muted-foreground">Note: {order.admin_notes}</p>}
                <p className="text-[11px] text-muted-foreground">UTR {order.utr}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Link
            to="/official/$officialId"
            params={{ officialId: order.event_id }}
            className="flex-1 rounded-full border border-border py-2.5 text-center text-sm font-medium"
          >
            View event
          </Link>
          {confirmed && (
            <button
              onClick={download}
              disabled={!qr}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download ticket
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
