import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_TYPES,
  getEvent,
  looksResidential,
  updateEvent,
  type EventType,
} from "@/lib/events";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/events/$eventId/edit")({
  component: EditEvent,
});

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditEvent() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  
  const [eventType, setEventType] = useState<EventType | "">("");
  const [startsAt, setStartsAt] = useState("");
  const [address, setAddress] = useState("");
  const [exactLocation, setExactLocation] = useState("");
  const [city, setCity] = useState("");
  const [minSize, setMinSize] = useState(4);
  const [maxSize, setMaxSize] = useState(8);
  
  const [minGirls, setMinGirls] = useState("");
  const [minBoys, setMinBoys] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const ev = await getEvent(eventId);
      if (!ev) { toast.error("Event not found"); navigate({ to: "/events" }); return; }
      if (!user || ev.host_id !== user.id) { toast.error("Only the host can edit"); navigate({ to: "/events/$eventId", params: { eventId } }); return; }
      setTitle(ev.title);
      setDesc(ev.description ?? "");
      setCategory(ev.category as Category);
      setEventType((ev.event_type as EventType) ?? "");
      setStartsAt(toLocalInput(ev.starts_at));
      setAddress(ev.location_address);
      setExactLocation((ev as any).exact_location ?? "");
      setCity(ev.city);
      setMinSize(ev.min_size);
      setMaxSize(ev.max_size);
      
      setMinGirls(ev.min_girls != null ? String(ev.min_girls) : "");
      setMinBoys(ev.min_boys != null ? String(ev.min_boys) : "");
      setLoading(false);
    })();
  }, [eventId]);

  const residentialWarn = address.length > 4 && looksResidential(address);

  const submit = async () => {
    if (!eventType) return toast.error("Pick an event type");
    if (!title.trim()) return toast.error("Add a title");
    if (!startsAt) return toast.error("Pick date and time");
    if (!address.trim()) return toast.error("Add a location");
    if (!city.trim()) return toast.error("Add city");
    if (minSize < 4) return toast.error("Minimum group size is 4");
    if (maxSize < minSize) return toast.error("Max must be ≥ min");
    setSaving(true);
    try {
      await updateEvent(eventId, {
        title: title.trim(),
        description: desc.trim() || null,
        category,
        event_type: eventType,
        starts_at: new Date(startsAt).toISOString(),
        location_address: address.trim(),
        exact_location: exactLocation.trim() || null,
        city: city.trim(),
        min_size: minSize,
        max_size: maxSize,
        entry_fee: null,
        min_girls: minGirls ? Number(minGirls) : null,
        min_boys: minBoys ? Number(minBoys) : null,
      } as any);
      toast.success("Event updated");
      navigate({ to: "/events/$eventId", params: { eventId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save changes");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="pb-32">
      <div className="px-5 pt-6 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/events/$eventId", params: { eventId } })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Gathr</h1>
      </div>

      <div className="px-5 pt-6 space-y-5 max-w-md mx-auto">
        <Field label="Event type">
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => (
              <button type="button" key={t} onClick={() => setEventType(t)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition ${eventType === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></Field>
        <Field label="Description">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={inputCls + " resize-none"} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Date & time">
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Area / neighborhood (public)">
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
          {residentialWarn && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>This looks like a residential address. Gathrs should meet at public places.</span>
            </div>
          )}
        </Field>
        <Field label="Exact meeting point (optional, private)">
          <input value={exactLocation} onChange={(e) => setExactLocation(e.target.value)} className={inputCls} />
        </Field>
        <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min group size">
            <input type="number" min={4} value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Max group size">
            <input type="number" min={minSize} value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min girls">
            <input type="number" min={0} value={minGirls} onChange={(e) => setMinGirls(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Min boys">
            <input type="number" min={0} value={minBoys} onChange={(e) => setMinBoys(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto flex gap-2">
          <button onClick={() => navigate({ to: "/events/$eventId", params: { eventId } })} className="flex-1 rounded-full border border-border py-3.5 text-[15px] font-medium">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-full bg-primary text-primary-foreground py-3.5 text-[15px] font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
