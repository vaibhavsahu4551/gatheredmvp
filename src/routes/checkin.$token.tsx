import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CheckCircle2, XCircle, AlertTriangle, Camera, CameraOff } from "lucide-react";
import {
  checkinContext,
  lookupTicket,
  markTicketUsed,
  parseTicketCode,
  type CheckinContext,
  type CheckinTicket,
} from "@/lib/checkin";

export const Route = createFileRoute("/checkin/$token")({
  head: () => ({
    meta: [
      { title: "Event check-in — Gathr" },
      { name: "description", content: "Scan Gathr ticket QR codes and check attendees in at the venue." },
      { property: "og:title", content: "Event check-in — Gathr" },
      { property: "og:description", content: "Scan Gathr ticket QR codes and check attendees in at the venue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckinPage,
});

function CheckinPage() {
  const { token } = Route.useParams();
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [ctx, setCtx] = useState<CheckinContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinTicket | null>(null);
  const [camError, setCamError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<string>("");

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      setCtx(await checkinContext(token, p));
    } catch {
      setCtx({ ok: false });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(""); }, [load]);

  const handleCode = useCallback(async (raw: string) => {
    const code = parseTicketCode(raw);
    if (!code || busy) return;
    setBusy(true);
    try {
      setResult(await lookupTicket(token, code, pin));
    } catch {
      setResult({ state: "INVALID" });
    } finally {
      setBusy(false);
    }
  }, [busy, pin, token]);

  const stopCam = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  async function startCam() {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      const tick = () => {
        const canvas = canvasRef.current;
        if (!canvas || !videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const vid = videoRef.current;
        const w = Math.min(640, vid.videoWidth || 640);
        const h = Math.round((vid.videoHeight / (vid.videoWidth || 1)) * w) || 480;
        canvas.width = w; canvas.height = h;
        const ctx2d = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx2d.drawImage(vid, 0, 0, w, h);
        const img = ctx2d.getImageData(0, 0, w, h);
        const found = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        if (found?.data && found.data !== lastRef.current) {
          lastRef.current = found.data;
          handleCode(found.data);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setCamError(e?.message ?? "Camera unavailable — use the code box below.");
      setScanning(false);
    }
  }

  async function confirmCheckIn() {
    if (!result?.order_code) return;
    setBusy(true);
    try {
      setResult(await markTicketUsed(token, result.order_code, pin));
    } catch {
      setResult({ state: "INVALID" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!ctx?.ok) {
    const needsPin = (ctx as any)?.needs_pin;
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-xl font-extrabold">{needsPin ? "Enter check-in PIN" : "Link not valid"}</h1>
        {needsPin ? (
          <>
            <input
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              inputMode="numeric"
              placeholder="PIN"
              className="rounded-xl border border-border bg-background px-4 py-3 text-center text-lg tracking-widest"
            />
            <button
              onClick={() => { setPin(pinInput); load(pinInput); }}
              className="rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Continue
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This check-in link has expired or been revoked. Ask the Gathr team for a fresh link.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Gathr check-in</p>
        <h1 className="text-lg font-extrabold leading-tight">{ctx.title}</h1>
        <p className="text-[12px] text-muted-foreground">
          {new Date(ctx.starts_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          {ctx.venue ? ` · ${ctx.venue}` : ""}
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-black">
        <video ref={videoRef} playsInline muted className={`h-64 w-full object-cover ${scanning ? "" : "hidden"}`} />
        {!scanning && (
          <div className="flex h-64 w-full items-center justify-center text-xs text-white/70">Camera is off</div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="mt-3 flex gap-2">
        {scanning ? (
          <button onClick={stopCam} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium">
            <CameraOff className="h-4 w-4" /> Stop scanning
          </button>
        ) : (
          <button onClick={startCam} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
            <Camera className="h-4 w-4" /> Scan ticket QR
          </button>
        )}
      </div>
      {camError && <p className="mt-2 text-[12px] text-destructive">{camError}</p>}

      <div className="mt-4 flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type ticket ID"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm uppercase"
        />
        <button
          onClick={() => { lastRef.current = ""; handleCode(manual); }}
          disabled={busy || !manual.trim()}
          className="rounded-xl bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Check
        </button>
      </div>

      {result && (
        <div className="mt-5 rounded-2xl border border-border p-4">
          <StateBanner state={result.state} />
          {result.order_code && (
            <div className="mt-3 space-y-1 text-sm">
              <div className="font-mono text-[13px]">{result.order_code}</div>
              <div className="font-semibold">{result.customer_name}</div>
              <div className="text-muted-foreground">{result.pass_name} × {result.quantity}</div>
            </div>
          )}
          {result.state === "VALID" && (
            <button
              onClick={confirmCheckIn}
              disabled={busy}
              className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Checking in…" : "Check in"}
            </button>
          )}
          <button
            onClick={() => { setResult(null); lastRef.current = ""; setManual(""); }}
            className="mt-2 w-full rounded-full border border-border py-2.5 text-sm"
          >
            Scan next
          </button>
        </div>
      )}
    </div>
  );
}

function StateBanner({ state }: { state: CheckinTicket["state"] }) {
  if (state === "VALID")
    return <Banner tone="ok" icon={<CheckCircle2 className="h-5 w-5" />} title="Valid ticket" sub="Tap check in to admit." />;
  if (state === "CHECKED_IN")
    return <Banner tone="ok" icon={<CheckCircle2 className="h-5 w-5" />} title="Checked in" sub="Attendee admitted." />;
  if (state === "USED")
    return <Banner tone="warn" icon={<AlertTriangle className="h-5 w-5" />} title="Already used" sub="This ticket was already checked in." />;
  if (state === "UNAUTHORIZED")
    return <Banner tone="bad" icon={<XCircle className="h-5 w-5" />} title="Link not valid" sub="Ask for a fresh check-in link." />;
  return <Banner tone="bad" icon={<XCircle className="h-5 w-5" />} title="Invalid ticket" sub="Not a valid ticket for this event." />;
}

function Banner({ tone, icon, title, sub }: { tone: "ok" | "warn" | "bad"; icon: React.ReactNode; title: string; sub: string }) {
  const cls =
    tone === "ok" ? "bg-green-500/15 text-green-700"
      : tone === "warn" ? "bg-amber-500/15 text-amber-700"
        : "bg-destructive/15 text-destructive";
  return (
    <div className={`flex items-start gap-3 rounded-xl px-3 py-3 ${cls}`}>
      {icon}
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-[12px] opacity-80">{sub}</div>
      </div>
    </div>
  );
}
