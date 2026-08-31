import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PhotoCropModal } from "@/components/PhotoCropModal";
import {
  OFFICIAL_CATEGORIES,
  adminCreateOfficialEvent,
  adminDeleteOfficialEvent,
  adminListOfficialEvents,
  adminUpdateOfficialEvent,
  resolveOfficialMedia,
  uploadOfficialMedia,
  type OfficialEvent,
  type OfficialEventInput,
} from "@/lib/official-events";

export const Route = createFileRoute("/admin/official")({
  component: AdminOfficialEvents,
});

const emptyForm = {
  title: "",
  category: OFFICIAL_CATEGORIES[0] as string,
  description: "",
  cover_url: "",
  date: "",
  time: "19:00",
  venue: "",
  city: "",
  price_text: "",
  organizer_name: "",
  organizer_logo: "",
  booking_whatsapp: "",
  ticket_url: "",
  terms: "",
  published: true,
  is_featured: false,
  is_pinned: false,
};
type Form = typeof emptyForm;

function toForm(e: OfficialEvent): Form {
  const d = new Date(e.starts_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    title: e.title,
    category: e.category,
    description: e.description ?? "",
    cover_url: e.cover_url ?? "",
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    venue: e.venue,
    city: e.city,
    price_text: e.price_text ?? "",
    organizer_name: e.organizer_name,
    organizer_logo: e.organizer_logo ?? "",
    booking_whatsapp: e.booking_whatsapp ?? "",
    ticket_url: e.ticket_url ?? "",
    terms: e.terms ?? "",
    published: e.published,
    is_featured: e.is_featured,
    is_pinned: e.is_pinned,
  };
}

function AdminOfficialEvents() {
  const [rows, setRows] = useState<OfficialEvent[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OfficialEvent | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setRows(await adminListOfficialEvents(q)); }
    catch (e: any) { toast.error(e.message ?? "Couldn't load official events"); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  async function toggle(e: OfficialEvent, patch: OfficialEventInput) {
    try { await adminUpdateOfficialEvent(e.id, patch); refresh(); }
    catch (err: any) { toast.error(err.message); }
  }

  async function remove(e: OfficialEvent) {
    if (!confirm(`Delete "${e.title}"? This cannot be undone.`)) return;
    try { await adminDeleteOfficialEvent(e.id); toast.success("Deleted"); refresh(); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Official Events</h1>
          <p className="text-xs text-muted-foreground">Admin-curated partner events. These are separate from user-created events.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm((v) => !v); }}
          className="rounded-lg bg-foreground px-3 py-2 text-sm text-background"
        >
          {showForm && !editing ? "Cancel" : "New official event"}
        </button>
      </div>

      {showForm && (
        <OfficialForm
          key={editing?.id ?? "new"}
          initial={editing ? toForm(editing) : emptyForm}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSaved={async (input) => {
            try {
              if (editing) { await adminUpdateOfficialEvent(editing.id, input); toast.success("Event updated"); }
              else { await adminCreateOfficialEvent(input); toast.success("Event created"); }
              setShowForm(false); setEditing(null); refresh();
            } catch (e: any) { toast.error(e.message); }
          }}
        />
      )}

      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={refresh} className="rounded-lg bg-foreground px-3 py-2 text-sm text-background">Search</button>
      </div>

      <div className="space-y-2">
        {loading && <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No official events yet.</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
            <Thumb path={r.cover_url} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{r.title}</span>
                {r.is_pinned && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">📌 Pinned</span>}
                {r.is_featured && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Featured</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.published ? "bg-green-500/20 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {r.published ? "Published" : "Draft"}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {r.category} · {new Date(r.starts_at).toLocaleString()} · {[r.venue, r.city].filter(Boolean).join(", ") || "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {r.organizer_name || "—"} · {r.price_text || "Free / TBA"} · WhatsApp {r.booking_whatsapp || "default"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button onClick={() => toggle(r, { published: !r.published })} className="underline">{r.published ? "Unpublish" : "Publish"}</button>
              <button onClick={() => toggle(r, { is_pinned: !r.is_pinned })} className="underline">{r.is_pinned ? "Unpin" : "Pin"}</button>
              <button onClick={() => toggle(r, { is_featured: !r.is_featured })} className="underline">{r.is_featured ? "Unfeature" : "Feature"}</button>
              <button onClick={() => { setEditing(r); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="underline">Edit</button>
              <button onClick={() => remove(r)} className="text-destructive underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Thumb({ path }: { path: string | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let a = true; resolveOfficialMedia(path).then((u) => a && setUrl(u)).catch(() => {}); return () => { a = false; }; }, [path]);
  return <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>;
}

function OfficialForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Form;
  onSaved: (input: OfficialEventInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const set = (k: keyof Form, v: any) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let alive = true;
    resolveOfficialMedia(f.cover_url).then((u) => alive && setCoverPreview(u)).catch(() => {});
    return () => { alive = false; };
  }, [f.cover_url]);

  async function pick(key: "cover_url" | "organizer_logo", file?: File | null) {
    if (!file) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = await uploadOfficialMedia(user.id, file);
      set(key, path);
      toast.success("Image uploaded");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.date) { toast.error("Pick a date"); return; }
    setBusy(true);
    try {
      await onSaved({
        title: f.title.trim(),
        category: f.category,
        description: f.description.trim() || null,
        cover_url: f.cover_url.trim() || null,
        starts_at: new Date(`${f.date}T${f.time || "19:00"}`).toISOString(),
        venue: f.venue.trim(),
        city: f.city.trim(),
        price_text: f.price_text.trim() || null,
        organizer_name: f.organizer_name.trim(),
        organizer_logo: f.organizer_logo.trim() || null,
        booking_whatsapp: f.booking_whatsapp.trim() || null,
        ticket_url: f.ticket_url.trim() || null,
        terms: f.terms.trim() || null,
        published: f.published,
        is_featured: f.is_featured,
        is_pinned: f.is_pinned,
      });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <Field label="Event name"><input required value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></Field>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Category">
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
            {OFFICIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Price / pass price"><input value={f.price_text} onChange={(e) => set("price_text", e.target.value)} placeholder="₹499 onwards" className={inputCls} /></Field>
        <Field label="Date"><input required type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={inputCls} /></Field>
        <Field label="Time"><input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={inputCls} /></Field>
        <Field label="Venue"><input value={f.venue} onChange={(e) => set("venue", e.target.value)} className={inputCls} /></Field>
        <Field label="City"><input value={f.city} onChange={(e) => set("city", e.target.value)} className={inputCls} /></Field>
        <Field label="Organizer name"><input value={f.organizer_name} onChange={(e) => set("organizer_name", e.target.value)} className={inputCls} /></Field>
        <Field label="WhatsApp booking number"><input value={f.booking_whatsapp} onChange={(e) => set("booking_whatsapp", e.target.value)} placeholder="Leave blank to use default" className={inputCls} /></Field>
      </div>

      <Field label="Cover / banner">
        <div className="overflow-hidden rounded-xl border border-border bg-muted aspect-[16/10] w-full max-w-sm">
          {coverPreview ? (
            <img src={coverPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">No cover yet</div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) setCropFile(file); e.target.value = ""; }}
            className="text-xs"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">You can zoom, drag and crop the banner after picking a file.</p>
        <input value={f.cover_url} onChange={(e) => set("cover_url", e.target.value)} placeholder="or paste an image URL" className={`${inputCls} mt-1`} />
        {cropFile && (
          <PhotoCropModal
            file={cropFile}
            aspect={16 / 10}
            round={false}
            size={1440}
            title="Crop the event banner"
            onCancel={() => setCropFile(null)}
            onConfirm={async (cropped) => { setCropFile(null); await pick("cover_url", cropped); }}
          />
        )}
      </Field>

      <Field label="Organizer logo (optional)">
        <input type="file" accept="image/*" onChange={(e) => pick("organizer_logo", e.target.files?.[0])} className="text-xs" />
        <input value={f.organizer_logo} onChange={(e) => set("organizer_logo", e.target.value)} placeholder="or paste an image URL" className={`${inputCls} mt-1`} />
      </Field>

      <Field label="Ticket booking URL (optional)"><input value={f.ticket_url} onChange={(e) => set("ticket_url", e.target.value)} className={inputCls} /></Field>
      <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} /></Field>
      <Field label="Terms / information"><textarea rows={3} value={f.terms} onChange={(e) => set("terms", e.target.value)} className={inputCls} /></Field>

      <div className="flex flex-wrap gap-4 text-xs">
        <Check label="Published" checked={f.published} onChange={(v) => set("published", v)} />
        <Check label="Featured" checked={f.is_featured} onChange={(v) => set("is_featured", v)} />
        <Check label="Pinned (top of feed)" checked={f.is_pinned} onChange={(v) => set("is_pinned", v)} />
      </div>

      <div className="flex gap-2">
        <button disabled={busy} className="rounded-lg bg-foreground px-4 py-2 text-sm text-background disabled:opacity-60">{busy ? "Saving…" : "Save event"}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs">{label}{children}</label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
