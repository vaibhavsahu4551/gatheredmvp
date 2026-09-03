import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ImagePlus, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAppSettingsCached } from "@/lib/admin";
import { getOfficialEvent, type OfficialEvent } from "@/lib/official-events";
import {
  listPasses,
  passRemaining,
  passSoldOut,
  submitOrder,
  upiPayLink,
  uploadPaymentProof,
  type OfficialPass,
} from "@/lib/official-passes";

export const Route = createFileRoute("/_authenticated/_app/official/$officialId/checkout")({
  validateSearch: (s: Record<string, unknown>) => ({
    passId: typeof s.passId === "string" ? s.passId : "",
    qty: Number(s.qty ?? 1) || 1,
  }),
  head: () => ({
    meta: [
      { title: "Pass checkout — Gathr" },
      { name: "description", content: "Pay by UPI and submit your payment reference to confirm your Gathr official event pass." },
      { property: "og:title", content: "Pass checkout — Gathr" },
      { property: "og:description", content: "Complete your UPI payment and submit the reference to get your pass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { officialId } = Route.useParams();
  const { passId, qty: qty0 } = Route.useSearch();
  const navigate = useNavigate();

  const [event, setEvent] = useState<OfficialEvent | null>(null);
  const [pass, setPass] = useState<OfficialPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [upi, setUpi] = useState<{ id: string; payee: string }>({ id: "", payee: "Gathr" });

  const [qty, setQty] = useState(Math.max(1, qty0));
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ev, passes, settings] = await Promise.all([
          getOfficialEvent(officialId),
          listPasses(officialId, { activeOnly: true }),
          getAppSettingsCached(),
        ]);
        if (!alive) return;
        setEvent(ev);
        setPass(passes.find((p) => p.id === passId) ?? passes[0] ?? null);
        setUpi({ id: (settings as any)?.upi_id ?? "", payee: (settings as any)?.upi_payee_name ?? "Gathr" });
      } catch (e: any) {
        toast.error(e.message ?? "Couldn't load checkout");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
      if (!alive || !data) return;
      setName((v) => v || (data as any).full_name || "");
      setPhone((v) => v || (data as any).phone || "");
      setEmail((v) => v || user.email || "");
    })();
    return () => { alive = false; };
  }, [officialId, passId]);

  function pickFile(f?: File | null) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const amount = pass ? Number(pass.price) * qty : 0;
  const maxQty = pass && pass.total_quantity > 0 ? Math.max(1, Math.min(10, passRemaining(pass))) : 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pass) return;
    if (!name.trim()) return toast.error("Enter your name");
    if (phone.trim().replace(/\D/g, "").length < 10) return toast.error("Enter a valid mobile number");
    if (utr.trim().length < 6) return toast.error("Enter the UPI reference / UTR number");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to book passes");
      const screenshotPath = file ? await uploadPaymentProof(user.id, file) : null;
      await submitOrder({
        eventId: officialId,
        pass: { id: pass.id, name: pass.name, price: Number(pass.price) },
        quantity: qty,
        utr,
        screenshotPath,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
      });
      setDone(true);
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't submit payment");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!event || !pass) return <div className="p-6 text-sm text-muted-foreground">This pass is no longer available.</div>;

  if (done) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/20 text-3xl">🟡</div>
        <h1 className="text-xl font-extrabold">Payment verification pending</h1>
        <p className="text-sm text-muted-foreground">
          We received your payment details for <span className="font-semibold text-foreground">{event.title}</span>. Our team verifies UPI
          payments manually — your pass activates once approved.
        </p>
        <Link to="/passes" className="mt-2 rounded-full bg-gradient-brand px-5 py-3 text-sm font-bold text-white">
          View my passes
        </Link>
        <Link to="/home" className="text-xs font-semibold text-muted-foreground underline">Back to home</Link>
      </div>
    );
  }

  const payLink = upiPayLink({ upiId: upi.id, payeeName: upi.payee, amount, note: `${event.title} ${pass.name}` });

  return (
    <div className="pb-28">
      <div className="flex items-center gap-2 px-4 pb-2 pt-5">
        <Link to="/official/$officialId" params={{ officialId }} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-extrabold tracking-tight">Checkout</h1>
      </div>

      <div className="space-y-4 px-5">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Your order</div>
          <div className="mt-1 font-bold">{event.title}</div>
          <div className="text-[12px] text-muted-foreground">{[event.venue, event.city].filter(Boolean).join(", ")}</div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{pass.name}</div>
              <div className="text-[12px] text-muted-foreground">₹{Number(pass.price).toLocaleString("en-IN")} per pass</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-full border border-border text-lg leading-none">−</button>
              <span className="w-6 text-center text-sm font-bold">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="h-8 w-8 rounded-full border border-border text-lg leading-none">+</button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold">Total payable</span>
            <span className="text-lg font-extrabold">₹{amount.toLocaleString("en-IN")}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><Smartphone className="h-4 w-4" /> Pay by UPI</div>
          {upi.id ? (
            <>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{upi.id}</span>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(upi.id); toast.success("UPI ID copied"); }}
                  className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold text-background"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Payee: {upi.payee}</p>
              <a href={payLink} className="mt-3 flex w-full items-center justify-center rounded-full bg-gradient-brand py-3 text-sm font-bold text-white">
                Pay ₹{amount.toLocaleString("en-IN")} in UPI app
              </a>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">UPI details aren't configured yet. Please contact the organizer.</p>
          )}
        </section>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Submit payment details</div>
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Your name" /></Field>
          <Field label="Mobile number"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} placeholder="10-digit mobile" /></Field>
          <Field label="Email (optional)"><input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputCls} placeholder="you@email.com" /></Field>
          <Field label="UPI reference / UTR number"><input value={utr} onChange={(e) => setUtr(e.target.value)} className={inputCls} placeholder="12-digit UTR from your UPI app" /></Field>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment screenshot</div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              <ImagePlus className="h-4 w-4" />
              {file ? file.name : "Upload screenshot (recommended)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            {preview && <img src={preview} alt="" className="mt-2 max-h-56 rounded-xl object-contain" />}
          </div>

          <button
            type="submit"
            disabled={busy || passSoldOut(pass)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-[15px] font-bold text-background disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {passSoldOut(pass) ? "Sold out" : "Submit for verification"}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Passes activate only after our team verifies your payment.
          </p>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
