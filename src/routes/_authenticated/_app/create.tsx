import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, EVENT_TYPES, looksResidential, type Category, type EventType } from "@/lib/events";
import { loadMe } from "@/lib/huddl";
import { createPost, listMyEvents } from "@/lib/feed";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/create")({
  component: CreateScreen,
});

function CreateScreen() {
  const [mode, setMode] = useState<"event" | "post">("event");
  return (
    <div className="pb-32">
      <div className="px-5 pt-8">
        <div className="inline-flex rounded-full border border-border p-0.5 text-sm">
          {(["event","post"] as const).map((t) => (
            <button key={t} onClick={() => setMode(t)}
              className={`px-4 py-1.5 rounded-full font-medium transition ${mode === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {t === "event" ? "Event" : "Post"}
            </button>
          ))}
        </div>
      </div>
      {mode === "event" ? <Create /> : <CreatePost />}
    </div>
  );
}

function Create() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<Category>("Coffee");
  const [eventType, setEventType] = useState<EventType | "">("");
  const [startsAt, setStartsAt] = useState("");
  const [address, setAddress] = useState("");
  const [exactLocation, setExactLocation] = useState("");

  const [city, setCity] = useState("");
  const [minSize, setMinSize] = useState(4);
  const [maxSize, setMaxSize] = useState(8);
  const [fee, setFee] = useState("");
  const [minGirls, setMinGirls] = useState("");
  const [minBoys, setMinBoys] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMe().then((me) => {
      if (!me) return;
      setUserId(me.user.id);
      setDefaultCity(me.profile?.city ?? "");
      setCity(me.profile?.city ?? "");
    });
  }, []);

  const residentialWarn = address.length > 4 && looksResidential(address);

  const submit = async () => {
    if (!eventType) return toast.error("Pick an event type");
    if (!title.trim()) return toast.error("Add a title");
    if (!startsAt) return toast.error("Pick date and time");
    if (new Date(startsAt).getTime() < Date.now()) return toast.error("Pick a future time");
    if (!address.trim()) return toast.error("Add a location");
    if (!city.trim()) return toast.error("Add city");
    if (minSize < 4) return toast.error("Minimum group size is 4");
    if (maxSize < minSize) return toast.error("Max must be ≥ min");

    setSaving(true);
    const { data, error } = await supabase.from("events").insert({
      host_id: userId,
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
      entry_fee: fee ? Number(fee) : null,
      min_girls: minGirls ? Number(minGirls) : null,
      min_boys: minBoys ? Number(minBoys) : null,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Event created");
    if (data) navigate({ to: "/events/$eventId", params: { eventId: data.id } });
    else navigate({ to: "/events" });
  };

  return (
    <div className="pb-32">
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Create a HUDDL</h1>
        <p className="mt-1 text-sm text-muted-foreground">Groups of 4 or more only. No solo hangs.</p>
      </header>

      <div className="px-5 space-y-5 max-w-md mx-auto">
        <Field label="Event type">
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setEventType(t)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition ${eventType === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Sunday coffee run" />
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
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Indiranagar, Bengaluru" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Your exact location is only shared with approved attendees.
          </p>
          {residentialWarn && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>This looks like a residential address. HUDDLs should meet at public places.</span>
            </div>
          )}
        </Field>

        <Field label="Exact meeting point (optional, private)">
          <input value={exactLocation} onChange={(e) => setExactLocation(e.target.value)} className={inputCls} placeholder="Third Wave Coffee, 12th Main — table by the window" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Only shown to attendees you've approved.
          </p>
        </Field>


        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder={defaultCity || "Bengaluru"} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min group size">
            <input type="number" min={4} value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Max group size">
            <input type="number" min={minSize} value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} className={inputCls} />
          </Field>
        </div>

        <Field label="Entry fee (optional)">
          <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} placeholder="₹ 0" />
        </Field>

        <div className="rounded-2xl border border-border p-4">
          <div className="text-sm font-medium">Gender balance (optional)</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Only confirm when at least this many join.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Min girls">
              <input type="number" min={0} value={minGirls} onChange={(e) => setMinGirls(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="Min boys">
              <input type="number" min={0} value={minBoys} onChange={(e) => setMinBoys(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button onClick={submit} disabled={saving} className="w-full rounded-full bg-primary py-3.5 text-[15px] font-medium text-primary-foreground disabled:opacity-50">
            {saving ? "Creating…" : "Create HUDDL"}
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

function CreatePost() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [eventId, setEventId] = useState<string>("");
  const [myEvents, setMyEvents] = useState<{ id: string; title: string; starts_at: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMe().then((me) => setCity(me?.profile?.city ?? ""));
    listMyEvents().then(setMyEvents);
  }, []);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async () => {
    if (!caption.trim() && !file) return toast.error("Add text or a photo");
    if (!city.trim()) return toast.error("City missing on your profile");
    setSaving(true);
    try {
      await createPost(city, caption, file ?? undefined, eventId || null);
      toast.success("Posted");
      navigate({ to: "/home" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not post");
    } finally { setSaving(false); }
  };

  return (
    <div>
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Share a post</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a photo, some words, or both.</p>
      </header>

      <div className="px-5 space-y-5 max-w-md mx-auto">
        <Field label="What's on your mind?">
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} maxLength={280}
            placeholder="Say something to your city…"
            className={inputCls + " resize-none"} />
          <div className="mt-1 text-right text-[11px] text-muted-foreground">{caption.length}/280</div>
        </Field>

        <Field label="Photo (optional)">
          {preview ? (
            <div className="relative">
              <img src={preview} alt="" className="w-full aspect-square object-cover rounded-2xl" />
              <button type="button" onClick={() => setFile(null)}
                className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-xs px-3 py-1">Remove</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-10 text-sm text-muted-foreground cursor-pointer">
              <ImagePlus className="h-5 w-5" />
              Tap to add a photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </Field>

        <Field label="Link to your event (optional)">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls}>
            <option value="">None</option>
            {myEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.title} · {new Date(e.starts_at).toLocaleDateString()}</option>
            ))}
          </select>
          {myEvents.length === 0 && (
            <div className="mt-1 text-[11px] text-muted-foreground">You haven't hosted any events yet.</div>
          )}
        </Field>
      </div>

      <div className="fixed inset-x-0 bottom-16 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button onClick={submit} disabled={saving} className="w-full rounded-full bg-primary py-3.5 text-[15px] font-medium text-primary-foreground disabled:opacity-50">
            {saving ? "Posting…" : "Share post"}
          </button>
        </div>
      </div>
    </div>
  );
}

