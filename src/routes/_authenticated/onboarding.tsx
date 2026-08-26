import { invalidateMe } from "@/lib/huddl";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimPendingReferral } from "@/lib/rewards";
import { INTERESTS, loadMe, signedPhotoUrl } from "@/lib/huddl";
import { compressImage } from "@/lib/image-compress";
import { normalizeHandle, normalizeSpotify } from "@/lib/socials";
import { PhotoCropModal } from "@/components/PhotoCropModal";
import { toast } from "sonner";
import { ArrowLeft, Camera, Instagram, Loader2, MapPin, Music2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

export const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;
export const SMOKING = ["Never", "Occasionally", "Regularly", "Prefer not to say"] as const;
export const DRINKING = ["Never", "Socially", "Regularly", "Prefer not to say"] as const;

const TOTAL = 12;

function ageFrom(dobStr: string): number {
  const d = new Date(dobStr);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState("");

  // fields
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [profession, setProfession] = useState("");
  const [smoking, setSmoking] = useState<string | null>(null);
  const [drinking, setDrinking] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [instagram, setInstagram] = useState("");
  const [spotify, setSpotify] = useState("");

  useEffect(() => {
    loadMe()
      .then(async (me) => {
        if (!me) {
          setLoading(false);
          return;
        }
        setUserId(me.user.id);
        if (me.profile?.onboarding_complete) {
          navigate({ to: "/home" });
          return;
        }
        const p: any = me.profile ?? {};
        setFullName(p.full_name ?? "");
        setDob(p.dob ?? "");
        setBio(p.bio ?? "");
        setGender(p.gender ?? "");
        setHeightCm(p.height_cm ?? null);
        setInterests(p.interests ?? []);
        setProfession(p.profession ?? "");
        setSmoking(p.smoking ?? null);
        setDrinking(p.drinking ?? null);
        setCity(p.city ?? "");
        setInstagram(p.instagram_handle ?? "");
        setSpotify(p.spotify_url ?? "");
        const existing = p.photos?.[0];
        if (existing) {
          setPhotoPath(existing);
          try {
            setPhotoPreview(await signedPhotoUrl(existing));
          } catch (e) {
            console.warn("Failed to load existing photo", e);
          }
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error("Onboarding load failed", e);
        toast.error("Couldn't load your account. Please refresh.");
        setLoading(false);
      });
  }, [navigate]);

  const uploadPhoto = async (file: File) => {
    if (!userId) {
      toast.error("Session not ready — please refresh and try again.");
      return;
    }
    setUploading(true);
    try {
      let toUpload: File = file;
      try {
        toUpload = await compressImage(file, { maxDim: 720, quality: 0.85 });
      } catch (e) {
        console.warn("Image compression failed, uploading original", e);
      }
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("profile-photos")
        .upload(path, toUpload, { upsert: false, contentType: toUpload.type });
      if (error) {
        console.error("Photo upload failed", error);
        toast.error(error.message || "Upload failed. Please try again.");
        return;
      }
      const prev = photoPath;
      setPhotoPath(path);
      setPhotoPreview(URL.createObjectURL(toUpload));
      toast.success("Photo added");
      if (prev) supabase.storage.from("profile-photos").remove([prev]).catch(() => {});
    } catch (e: any) {
      console.error("Unexpected upload error", e);
      toast.error(e?.message || "Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const finish = async (withSocials: boolean) => {
    if (!photoPath) return toast.error("Add a profile photo");
    let ig: string | null = null;
    let sp: string | null = null;
    if (withSocials) {
      if (instagram.trim()) {
        ig = normalizeHandle(instagram);
        if (!ig) return toast.error("That Instagram handle doesn't look right");
      }
      if (spotify.trim()) {
        sp = normalizeSpotify(spotify);
        if (!sp) return toast.error("Enter a valid Spotify link");
      }
    }
    setSaving(true);
    await claimPendingReferral().catch(() => {});
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName.trim(),
        dob,
        gender,
        bio: bio.trim() || null,
        height_cm: heightCm,
        interests,
        profession: profession.trim() || null,
        smoking,
        drinking,
        city: city.trim() || null,
        photos: [photoPath],
        instagram_handle: ig,
        spotify_url: sp,
        onboarding_complete: true,
      } as any,
      { onConflict: "id" },
    );
    setSaving(false);
    if (error) {
      console.error("Onboarding save failed", error);
      return toast.error(error.message);
    }
    invalidateMe();
    toast.success("Welcome to Gathr");
    navigate({ to: "/home" });
  };

  const next = () => setStep((s) => Math.min(TOTAL, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const canNext = () => {
    if (step === 1) return fullName.trim().length >= 2;
    if (step === 2) return !!dob && ageFrom(dob) >= 18;
    if (step === 4) return !!gender;
    if (step === 11) return !!photoPath;
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
      {pendingFile && (
        <PhotoCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={(cropped) => {
            setPendingFile(null);
            uploadPhoto(cropped);
          }}
        />
      )}

      <header className="px-6 pt-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button onClick={back} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-brand transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{step}/{TOTAL}</span>
        </div>
      </header>

      <div className="mt-8 px-6 max-w-md mx-auto">
        {step === 1 && (
          <Step title="What's your name?" sub="This is how you'll show up on Gathr.">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Chen" maxLength={60} className={inputCls} />
          </Step>
        )}

        {step === 2 && (
          <Step title="When were you born?" sub="Gathr is 18+ only. Your date of birth stays private — only your age shows.">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
            {dob && ageFrom(dob) < 18 && (
              <p className="mt-2 text-sm text-destructive">You must be 18 or older to use Gathr.</p>
            )}
            {dob && ageFrom(dob) >= 18 && <p className="mt-2 text-sm text-muted-foreground">You're {ageFrom(dob)}.</p>}
          </Step>
        )}

        {step === 3 && (
          <Step title="Write a short bio" sub="Optional — a line or two about you." optional onSkip={next}>
            <textarea rows={4} maxLength={150} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Coffee snob. Weekend trekker." className={inputCls} />
            <div className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/150</div>
          </Step>
        )}

        {step === 4 && (
          <Step title="How do you identify?" sub="Shown on your profile.">
            <Choices options={GENDERS as unknown as string[]} value={gender} onChange={setGender} />
          </Step>
        )}

        {step === 5 && (
          <Step title="How tall are you?" sub="Optional." optional onSkip={() => { setHeightCm(null); next(); }}>
            <HeightPicker value={heightCm} onChange={setHeightCm} />
          </Step>
        )}

        {step === 6 && (
          <Step title="What are you into?" sub="Pick a few — we use these to suggest people and plans." optional onSkip={next}>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const active = interests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInterests((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition ${active ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border"}`}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 7 && (
          <Step title="What do you do?" sub="Optional — job title, field or studies." optional onSkip={() => { setProfession(""); next(); }}>
            <input value={profession} onChange={(e) => setProfession(e.target.value)} maxLength={60} placeholder="Product designer" className={inputCls} />
            <div className="mt-3 flex flex-wrap gap-2">
              {["Student", "Engineer", "Designer", "Marketing", "Finance", "Healthcare", "Founder", "Other"].map((o) => (
                <button key={o} type="button" onClick={() => setProfession(o)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium border ${profession === o ? "bg-foreground text-background border-foreground" : "border-border"}`}>{o}</button>
              ))}
            </div>
          </Step>
        )}

        {step === 8 && (
          <Step title="Do you smoke?" sub="Optional — you can skip this." optional onSkip={() => { setSmoking(null); next(); }}>
            <Choices options={SMOKING as unknown as string[]} value={smoking ?? ""} onChange={setSmoking} />
          </Step>
        )}

        {step === 9 && (
          <Step title="Do you drink?" sub="Optional — you can skip this." optional onSkip={() => { setDrinking(null); next(); }}>
            <Choices options={DRINKING as unknown as string[]} value={drinking ?? ""} onChange={setDrinking} />
          </Step>
        )}

        {step === 10 && (
          <Step title="Where are you based?" sub="We use your city to show nearby plans." optional onSkip={next}>
            <LocationStep city={city} setCity={setCity} />
          </Step>
        )}

        {step === 11 && (
          <Step title="Add a profile photo" sub="Use a clear photo of your face — this will be used for verification. Pick a photo, then zoom and drag to frame it.">
            <div className="flex flex-col items-center">
              <label className={`relative h-40 w-40 rounded-full bg-muted overflow-hidden flex items-center justify-center shadow-elevated ${uploading ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
                {photoPreview ? (
                  <img src={photoPreview} className="h-full w-full object-cover" alt="" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Camera className="h-8 w-8 mb-1" />
                    <span className="text-xs">Tap to add</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) setPendingFile(f);
                  }}
                />
              </label>
              {photoPreview && !uploading && <div className="mt-4 text-xs text-muted-foreground">Tap the photo to replace or re-crop</div>}
            </div>
          </Step>
        )}

        {step === 12 && (
          <Step title="Add your socials" sub="Optional — these show as tappable links on your profile.">
            <div className="space-y-5">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium"><Instagram className="h-4 w-4" /> Instagram</label>
                <div className="flex items-center rounded-2xl border border-input bg-background px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="text-muted-foreground">@</span>
                  <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="yourhandle" maxLength={40} className="w-full bg-transparent py-3 pl-1 text-[15px] outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium"><Music2 className="h-4 w-4" /> Spotify</label>
                <input value={spotify} onChange={(e) => setSpotify(e.target.value)} placeholder="https://open.spotify.com/user/…" maxLength={200} className={inputCls} />
              </div>
            </div>
          </Step>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto space-y-2">
          {step < TOTAL ? (
            <button
              onClick={next}
              disabled={!canNext() || uploading}
              className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Next"}
            </button>
          ) : (
            <>
              <button onClick={() => finish(true)} disabled={saving} className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Finish"}
              </button>
              <button onClick={() => finish(false)} disabled={saving} className="w-full rounded-full border border-border bg-background py-3.5 text-[15px] font-medium disabled:opacity-50">
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Step({ title, sub, children, optional, onSkip }: { title: string; sub?: string; children: React.ReactNode; optional?: boolean; onSkip?: () => void }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {optional && onSkip && (
          <button onClick={onSkip} className="shrink-0 text-sm font-semibold text-muted-foreground underline underline-offset-4">Skip</button>
        )}
      </div>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Choices({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium transition ${value === o ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function HeightPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [unit, setUnit] = useState<"cm" | "ft">("cm");
  const cm = value ?? 170;
  const totalIn = Math.round(cm / 2.54);
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  return (
    <div>
      <div className="grid grid-cols-2 rounded-full bg-muted p-1 mb-5">
        {(["cm", "ft"] as const).map((u) => (
          <button key={u} onClick={() => setUnit(u)} className={`h-9 rounded-full text-[13px] font-semibold ${unit === u ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            {u === "cm" ? "Centimetres" : "Feet / inches"}
          </button>
        ))}
      </div>
      <div className="text-center text-3xl font-semibold tabular-nums">
        {unit === "cm" ? `${cm} cm` : `${ft}′ ${inch}″`}
      </div>
      <input type="range" min={120} max={220} value={cm} onChange={(e) => onChange(Number(e.target.value))} className="mt-4 w-full accent-[color:var(--brand-2)]" />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>120 cm</span><span>220 cm</span></div>
    </div>
  );
}

function LocationStep({ city, setCity }: { city: string; setCity: (c: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ label: string; city: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    setBusy(true);
    const ctl = new AbortController();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&featuretype=city&q=${encodeURIComponent(term)}`, { headers: { Accept: "application/json" }, signal: ctl.signal });
        const j = await r.json();
        const seen = new Set<string>();
        const out: { label: string; city: string }[] = [];
        for (const row of j as any[]) {
          const a = row.address ?? {};
          const c = a.city || a.town || a.village || a.municipality || a.county || a.state || row.name;
          if (!c) continue;
          const label = [c, a.state, a.country].filter(Boolean).join(", ");
          if (seen.has(label)) continue;
          seen.add(label);
          out.push({ label, city: c });
        }
        setHits(out);
      } catch (e: any) {
        if (e?.name !== "AbortError") console.warn("City search failed", e);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => { ctl.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const detect = () => {
    if (!("geolocation" in navigator)) return toast.error("Location isn't available on this device");
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=10`, { headers: { Accept: "application/json" } });
          const j = await r.json();
          const a = j.address ?? {};
          const c = a.city || a.town || a.village || a.municipality || a.county || a.state;
          if (c) { setCity(c); setQ(""); setHits([]); toast.success(`Set to ${c}`); }
          else toast.error("Couldn't find your city — search instead");
        } catch {
          toast.error("Couldn't detect your location");
        } finally {
          setDetecting(false);
        }
      },
      () => { setDetecting(false); toast.error("Location permission denied — search your city instead"); },
      { timeout: 10000 },
    );
  };

  return (
    <div>
      {city && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium">
          <MapPin className="h-4 w-4 text-primary" /> {city}
        </div>
      )}
      <button onClick={detect} disabled={detecting} className="w-full rounded-2xl border border-border py-3 text-[15px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {detecting ? "Detecting…" : "Use my current location"}
      </button>
      <div className="relative mt-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city…" className="w-full rounded-2xl border border-input bg-background pl-9 pr-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </div>
      {busy && <div className="py-4 flex justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>}
      <div className="mt-2">
        {hits.map((h) => (
          <button key={h.label} onClick={() => { setCity(h.city); setQ(""); setHits([]); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted text-left">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm">{h.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
