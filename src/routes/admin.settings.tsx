import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAppSettings, setDefaultBookingWhatsapp, setUpiSettings, setSubscriptionEnabled, setMaintenance, DEFAULT_MAINTENANCE_MESSAGE, listBanners, createBanner, updateBanner, deleteBanner, type HomeBanner } from "@/lib/admin";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const [subEnabled, setSubEnabled] = useState(false);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintMessage, setMaintMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");

  async function refresh() {
    const s = await getAppSettings();
    setSubEnabled(s.subscription_enabled);
    setMaintEnabled(s.maintenance_enabled);
    setMaintMessage(s.maintenance_message ?? "");
    setWaNumber(s.default_booking_whatsapp ?? "");
    setUpiId(s.upi_id ?? "");
    setUpiName(s.upi_payee_name ?? "");
    setBanners(await listBanners());
  }
  useEffect(() => { refresh(); }, []);

  async function toggleSub(v: boolean) {
    try { await setSubscriptionEnabled(v); setSubEnabled(v); toast.success(v ? "Premium features ON" : "Premium features OFF"); }
    catch (e: any) { toast.error(e.message); }
  }

  async function toggleMaint(v: boolean) {
    try {
      await setMaintenance({ enabled: v, message: maintMessage.trim() || null });
      setMaintEnabled(v);
      toast.success(v ? "Maintenance mode ON" : "Maintenance mode OFF");
    } catch (e: any) { toast.error(e.message); }
  }

  async function saveMessage() {
    try { await setMaintenance({ message: maintMessage.trim() || null }); toast.success("Message saved"); }
    catch (e: any) { toast.error(e.message); }
  }

  async function saveUpi() {
    try {
      await setUpiSettings({ upi_id: upiId.trim() || null, upi_payee_name: upiName.trim() || null });
      toast.success("UPI details saved");
    } catch (e: any) { toast.error(e.message); }
  }

  async function saveWhatsapp() {
    try { await setDefaultBookingWhatsapp(waNumber.trim() || null); toast.success("Default WhatsApp number saved"); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">Settings</h1>
      </section>

      <section className="rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Subscription / Premium features</div>
            <div className="text-xs text-muted-foreground">Platform-wide toggle. When off, paywalls and premium CTAs are hidden.</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={subEnabled} onChange={(e) => toggleSub(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-muted rounded-full peer-checked:bg-foreground transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:bg-background after:rounded-full after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div>
          <div className="font-medium">Default booking WhatsApp number</div>
          <div className="text-xs text-muted-foreground">Used for official events that don't have their own booking number.</div>
        </div>
        <div className="flex gap-2">
          <input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="e.g. 919876543210"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={saveWhatsapp} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Save</button>
        </div>
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div>
          <div className="font-medium">UPI payment details</div>
          <div className="text-xs text-muted-foreground">Shown on the official-event checkout screen for manual UPI payments.</div>
        </div>
        <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="UPI ID e.g. gathr@upi"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Payee name e.g. Gathr Events"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={saveUpi} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Save</button>
        </div>
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Maintenance mode</div>
            <div className="text-xs text-muted-foreground">Blocks all non-admin users with a full-screen notice. Admins keep full access.</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={maintEnabled} onChange={(e) => toggleMaint(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-muted rounded-full peer-checked:bg-foreground transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:bg-background after:rounded-full after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>
        <label className="block text-xs">Custom message
          <textarea rows={2} value={maintMessage} onChange={(e) => setMaintMessage(e.target.value)}
            placeholder={DEFAULT_MAINTENANCE_MESSAGE}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2">
          <button onClick={saveMessage} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Save message</button>
          <button onClick={() => setPreview(true)} className="rounded-lg border border-border px-3 py-2 text-sm">Preview screen</button>
        </div>
        {maintEnabled && <div className="text-xs text-destructive">Maintenance mode is currently ON for all non-admin users.</div>}
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 bg-background">
          <MaintenanceScreen message={maintMessage} />
          <button onClick={() => setPreview(false)} className="absolute top-4 right-4 rounded-lg border border-border bg-background px-3 py-2 text-sm">Close preview</button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Home banner</h2>
          <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">
            {showForm ? "Cancel" : "New banner"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Only one active banner shows at a time (most recent). Banners are persistent — users cannot dismiss them.</p>
        {showForm && <BannerForm onSaved={() => { setShowForm(false); refresh(); }} />}

        <div className="space-y-2">
          {banners.map((b) => {
            const now = new Date();
            const started = new Date(b.starts_at) <= now;
            const expired = b.ends_at ? new Date(b.ends_at) < now : false;
            const live = b.active && started && !expired;
            return (
              <div key={b.id} className="rounded-lg border border-border p-3 flex items-start gap-3">
                {b.image_url && <img src={b.image_url} alt="" className="h-16 w-24 object-cover rounded" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{b.title}</div>
                    {live ? <span className="text-[10px] rounded-full bg-green-500/20 text-green-700 px-2 py-0.5">LIVE</span>
                          : <span className="text-[10px] rounded-full bg-muted px-2 py-0.5">{expired ? "expired" : b.active ? "scheduled" : "off"}</span>}
                  </div>
                  {b.body && <div className="text-xs text-muted-foreground line-clamp-2">{b.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(b.starts_at).toLocaleDateString()} → {b.ends_at ? new Date(b.ends_at).toLocaleDateString() : "no end"}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <button onClick={() => updateBanner(b.id, { active: !b.active }).then(refresh)} className="underline">
                    {b.active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => confirm("Delete banner?") && deleteBanner(b.id).then(refresh)} className="underline text-destructive">Delete</button>
                </div>
              </div>
            );
          })}
          {banners.length === 0 && <div className="text-xs text-muted-foreground">No banners yet.</div>}
        </div>
      </section>
    </div>
  );
}

function BannerForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [eventId, setEventId] = useState("");
  const [starts, setStarts] = useState(new Date().toISOString().slice(0, 16));
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createBanner({
        title, body: body || null, image_url: imageUrl || null, event_id: eventId || null,
        starts_at: new Date(starts).toISOString(),
        ends_at: ends ? new Date(ends).toISOString() : null,
        active: true,
      });
      toast.success("Banner created");
      onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
      <label className="block text-xs">Title
        <input required value={title} onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-xs">Body (optional)
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} />
      </label>
      <label className="block text-xs">Image URL (optional)
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-xs">Linked event ID (optional)
        <input value={eventId} onChange={(e) => setEventId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="uuid" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">Starts
          <input required type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs">Ends (optional)
          <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      <button disabled={busy} className="rounded-lg bg-foreground text-background px-4 py-2 text-sm">
        {busy ? "Saving…" : "Create banner"}
      </button>
    </form>
  );
}
