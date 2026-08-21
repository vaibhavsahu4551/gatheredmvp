import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPES, looksResidential, type EventType } from "@/lib/events";
import { loadMe } from "@/lib/huddl";
import { loadMyPrideProfile, isPrideSuspended } from "@/lib/pride";
import { createPost, listMyEvents } from "@/lib/feed";
import { canCreateEvent, FREE_EVENT_CREATE_LIMIT } from "@/lib/entitlements";
import { listMyCircles, postToCircleChat, type CircleWithMeta } from "@/lib/circles";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { VerifyGatePrompt } from "@/components/VerifyGatePrompt";
import { useVerification } from "@/hooks/useVerification";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, ShieldAlert, Sparkles } from "lucide-react";
import { pickPlaceholderCover, uploadEventCover } from "@/lib/event-cover";

export const Route = createFileRoute("/_authenticated/_app/create")({
  validateSearch: (s: Record<string, unknown>): { circle?: string } =>
    typeof s.circle === "string" ? { circle: s.circle } : {},
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
  
  const [eventType, setEventType] = useState<EventType | "">("");
  const [startsAt, setStartsAt] = useState("");
  const [address, setAddress] = useState("");
  const [exactLocation, setExactLocation] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  const [city, setCity] = useState("");
  const [minSize, setMinSize] = useState(4);
  const [maxSize, setMaxSize] = useState(8);
  
  const [minGirls, setMinGirls] = useState("");
  const [minBoys, setMinBoys] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [prideOptIn, setPrideOptIn] = useState(false);
  const [isPride, setIsPride] = useState(false);

  const [hasPrideIdentity, setHasPrideIdentity] = useState(false);
  const [prideSuspended, setPrideSuspendedState] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const verification = useVerification();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const search = Route.useSearch();
  const [venueType, setVenueType] = useState<"public" | "residence">("public");
  const [beginnerFriendly, setBeginnerFriendly] = useState(false);
  const [circles, setCircles] = useState<CircleWithMeta[]>([]);
  const [circleId, setCircleId] = useState<string>(search.circle ?? "");

  useEffect(() => {
    listMyCircles().then(setCircles).catch(() => {});
  }, []);

  useEffect(() => {
    loadMe().then(async (me) => {
      if (!me) return;
      setUserId(me.user.id);
      setDefaultCity(me.profile?.city ?? "");
      setCity(me.profile?.city ?? "");
      const opted = !!me.profile?.pride_opt_in;
      setPrideOptIn(opted);
      if (opted) {
        const [ident, suspended] = await Promise.all([loadMyPrideProfile(), isPrideSuspended()]);
        setHasPrideIdentity(!!ident);
        setPrideSuspendedState(suspended);
      }
    });
  }, []);


  useEffect(() => {
    if (!coverFile) { setCoverPreview(""); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const residentialWarn = address.length > 4 && looksResidential(address);

  const submit = async () => {
    if (!verification.loading && !verification.isVerified) {
      setVerifyOpen(true);
      return;
    }
    if (!eventType) return toast.error("Pick an event type");
    if (!title.trim()) return toast.error("Add a title");
    if (!startsAt) return toast.error("Pick date and time");
    if (new Date(startsAt).getTime() < Date.now()) return toast.error("Pick a future time");
    if (!address.trim()) return toast.error("Add a location");
    if (!city.trim()) return toast.error("Add city");
    if (minSize < 4) return toast.error("Minimum group size is 4");
    if (maxSize < minSize) return toast.error("Max must be ≥ min");
    if (prideOptIn && isPride) {
      if (prideSuspended) return toast.error("Your Pride access is suspended.");
      if (!hasPrideIdentity) return toast.error("Set up your Pride identity first");
    }

    setSaving(true);

    // Free-tier event creation limit.
    const gate = await canCreateEvent();
    if (!gate.allowed) {
      setSaving(false);
      setUpgradeMsg(`Free members can create up to ${FREE_EVENT_CREATE_LIMIT} events every 30 days. You've used ${gate.used}. Upgrade to Premium for unlimited hosting.`);
      setUpgradeOpen(true);
      return;
    }

    let cover_url: string;
    try {
      cover_url = coverFile
        ? await uploadEventCover(userId, coverFile)
        : pickPlaceholderCover(eventType);
    } catch (e: any) {
      setSaving(false);
      return toast.error(e?.message ?? "Could not upload the photo");
    }

    const { data, error } = await supabase.from("events").insert({
      host_id: userId,
      title: title.trim(),
      description: desc.trim() || null,
      
      event_type: eventType,
      starts_at: new Date(startsAt).toISOString(),
      location_address: address.trim(),
      exact_location: exactLocation.trim() || null,
      location_lat: pin?.lat ?? null,
      location_lng: pin?.lng ?? null,
      city: city.trim(),

      min_size: minSize,
      max_size: maxSize,
      entry_fee: null,
      min_girls: minGirls ? Number(minGirls) : null,
      min_boys: minBoys ? Number(minBoys) : null,
      is_pride: prideOptIn && isPride,
      cover_url,
      venue_type: venueType,
      beginner_friendly: beginnerFriendly,
      circle_id: !(prideOptIn && isPride) && circleId ? circleId : null,
    } as any).select("id").maybeSingle();

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Event created");
    if (circleId && !(prideOptIn && isPride)) {
      postToCircleChat(circleId, `New Gathr: ${title.trim()}`).catch(() => {});
    }
    if (data) navigate({ to: "/events/$eventId", params: { eventId: data.id } });
    else navigate({ to: prideOptIn && isPride ? "/pride" : "/events" });
  };


  return (
    <div className="pb-32">
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Create a Gathr</h1>
        <p className="mt-1 text-sm text-muted-foreground">Groups of 4 or more only. No solo hangs.</p>
      </header>

      <div className="px-5 space-y-5 max-w-md mx-auto">
        {prideOptIn && (
          <div className="rounded-2xl border border-border p-4 bg-gradient-to-r from-rose-50 via-fuchsia-50 to-indigo-50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-fuchsia-500" /> Post in Pride section
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Only visible to other Pride members. Won't appear in the main feed. Your Pride identity is used — not your real profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPride((v) => !v)}
                aria-pressed={isPride}
                disabled={prideSuspended}
                className={`relative shrink-0 h-6 w-11 rounded-full transition ${isPride ? "bg-gradient-brand" : "bg-muted"} disabled:opacity-40`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isPride ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            {isPride && !hasPrideIdentity && !prideSuspended && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-fuchsia-200 bg-white/60 p-2.5 text-xs">
                <ShieldAlert className="h-4 w-4 mt-0.5 text-fuchsia-600 shrink-0" />
                <div className="flex-1">
                  You need a Pride identity before posting here.{" "}
                  <Link to="/pride/setup" className="font-semibold underline">Set it up →</Link>
                </div>
              </div>
            )}
            {isPride && prideSuspended && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                Your Pride access is suspended due to community guideline violations.
              </div>
            )}
            {isPride && hasPrideIdentity && (
              <div className="mt-3 rounded-xl border border-fuchsia-200 bg-white/60 p-2.5 text-[11px] text-muted-foreground">
                Community rule: No nudity or sexually explicit content. Photos are auto-moderated; violations may suspend Pride access.
              </div>
            )}
          </div>
        )}
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

        <Field label="Description">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            className={inputCls + " resize-none"}
            placeholder="What's the plan? Who should join? Anything people should know."
          />
        </Field>




        <Field label="Event photo (optional)">
          {coverPreview ? (
            <div className="relative">
              <img src={coverPreview} alt="" className="w-full aspect-video object-cover rounded-2xl" />
              <button type="button" onClick={() => setCoverFile(null)}
                className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-xs px-3 py-1">Remove</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-8 text-sm text-muted-foreground cursor-pointer">
              <ImagePlus className="h-5 w-5" />
              Add a cover photo
              <span className="text-[11px]">We'll pick one for you if you skip this.</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
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
              <span>This looks like a residential address. Gathrs should meet at public places.</span>
            </div>
          )}
        </Field>

        <Field label="Drop a pin (optional)">
          <LocationMap
            lat={pin?.lat ?? null}
            lng={pin?.lng ?? null}
            onPick={(lat, lng) => setPin({ lat, lng })}
            height={200}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Everyone sees an approximate area circle. Approved attendees see the exact pin.
          </p>
          {pin && (
            <button type="button" onClick={() => setPin(null)} className="mt-1 text-[11px] font-medium underline text-muted-foreground">
              Remove pin
            </button>
          )}
        </Field>

        <Field label="Exact meeting point (optional, private)">
          <input value={exactLocation} onChange={(e) => setExactLocation(e.target.value)} className={inputCls} placeholder="Third Wave Coffee, 12th Main — table by the window" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Only shown to attendees you've approved.
          </p>
        </Field>

        <Field label="Venue type">
          <div className="flex gap-2">
            {([["public","Public venue"],["residence","Private residence"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVenueType(v)}
                className={`flex-1 rounded-2xl px-3 py-2.5 text-[13px] font-medium border transition ${venueType === v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {venueType === "residence" && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Private residences carry extra risk. Only approve people you trust, share your plans with a friend, and consider meeting in public first.</span>
            </div>
          )}
        </Field>

        <div className="rounded-2xl border border-border p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Beginner friendly</div>
            <p className="mt-0.5 text-xs text-muted-foreground">Surfaces this Gathr to people new to the app.</p>
          </div>
          <button
            type="button"
            onClick={() => setBeginnerFriendly((v) => !v)}
            aria-pressed={beginnerFriendly}
            className={`relative shrink-0 h-6 w-11 rounded-full transition ${beginnerFriendly ? "bg-gradient-brand" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${beginnerFriendly ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        {circles.length > 0 && !(prideOptIn && isPride) && (
          <Field label="Link to a Circle (optional)">
            <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {circles.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-muted-foreground">We'll drop a note in that Circle's chat.</p>
          </Field>
        )}

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
            {saving ? "Creating…" : "Create Gathr"}
          </button>
        </div>
      </div>
      <UpgradePrompt open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="You've hit the free event limit" message={upgradeMsg} />
      <VerifyGatePrompt
        open={verifyOpen}
        action="create"
        status={verification.status === "verified" ? "unverified" : verification.status}
        reason={verification.rejection_reason}
        onClose={() => setVerifyOpen(false)}
      />
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

