import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { INTERESTS, loadMe, invalidateMe, signedPhotoUrl } from "@/lib/huddl";
import { invalidate } from "@/lib/cache";
import { normalizeHandle, normalizeSpotify } from "@/lib/socials";
import { PhotoCropModal } from "@/components/PhotoCropModal";
import { toast } from "sonner";
import { ArrowLeft, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/profile/edit")({
  component: EditProfile,
});

function EditProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [originalInterests, setOriginalInterests] = useState<string[]>([]);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [instagram, setInstagram] = useState("");
  const [spotify, setSpotify] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [profession, setProfession] = useState("");
  const [smoking, setSmoking] = useState("");
  const [drinking, setDrinking] = useState("");

  useEffect(() => {
    loadMe().then(async (me) => {
      if (!me?.profile) return;
      const p: any = me.profile;
      setUserId(me.user.id);
      setFullName(p.full_name ?? "");
      setBio(p.bio ?? "");
      setInstagram(p.instagram_handle ?? "");
      setSpotify(p.spotify_url ?? "");
      setDob(p.dob ?? "");
      setGender(p.gender ?? "");
      setCity(p.city ?? "");
      setHeightCm(p.height_cm ? String(p.height_cm) : "");
      setProfession(p.profession ?? "");
      setSmoking(p.smoking ?? "");
      setDrinking(p.drinking ?? "");
      const loadedInterests = p.interests ?? [];
      setInterests(loadedInterests);
      setOriginalInterests(loadedInterests);
      const existing = p.photos?.[0];
      if (existing) {
        setPhotoPath(existing);
        setPhotoPreview(await signedPhotoUrl(existing));
      }
      setLoading(false);
    });
  }, []);


  const toggleInterest = (i: string) => {
    setInterests((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };

  const uploadPhoto = async (file: File) => {
    const { compressImage } = await import("@/lib/image-compress");
    const compressed = await compressImage(file, { maxDim: 720, quality: 0.85 });
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("profile-photos").upload(path, compressed, { upsert: false, contentType: compressed.type });
    if (error) return toast.error(error.message);
    if (photoPath) await supabase.storage.from("profile-photos").remove([photoPath]);
    setPhotoPath(path);
    setPhotoPreview(URL.createObjectURL(compressed));
  };

  const save = async () => {
    const name = fullName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (bio.length > 150) {
      toast.error("Bio must be 150 characters or less");
      return;
    }
    const finalInterests = interests.length > 0 ? interests : originalInterests;

    let ig: string | null = null;
    if (instagram.trim()) {
      ig = normalizeHandle(instagram);
      if (!ig) return toast.error("That Instagram handle doesn't look right");
    }
    let sp: string | null = null;
    if (spotify.trim()) {
      sp = normalizeSpotify(spotify);
      if (!sp) return toast.error("Enter a valid Spotify link");
    }

    const h = heightCm.trim() ? Number(heightCm) : null;
    if (h !== null && (Number.isNaN(h) || h < 120 || h > 220)) {
      return toast.error("Enter a height between 120 and 220 cm");
    }
    if (dob) {
      const d = new Date(dob);
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      if (age < 18) return toast.error("You must be 18 or older");
    }

    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: name || null,
      bio: bio.trim() || null,
      interests: finalInterests,
      instagram_handle: ig,
      spotify_url: sp,
      dob: dob || null,
      gender: gender || null,
      city: city.trim() || null,
      height_cm: h,
      profession: profession.trim() || null,
      smoking: smoking || null,
      drinking: drinking || null,
      photos: photoPath ? [photoPath] : [],
    } as any).eq("id", userId);

    setSaving(false);
    if (error) return toast.error(error.message);
    invalidateMe();
    invalidate("photo:*");
    toast.success("Profile updated");
    navigate({ to: "/profile" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
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

      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/profile" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight flex-1">Edit profile</h1>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="mt-6 px-6 max-w-md mx-auto space-y-6">
        <div className="flex flex-col items-center">
          <label className="relative h-32 w-32 rounded-full bg-muted overflow-hidden cursor-pointer flex items-center justify-center shadow-elevated">
            {photoPreview ? (
              <img src={photoPreview} className="h-full w-full object-cover" alt="" />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-xs">Add</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setPendingFile(f);
              }}
            />

          </label>
          <div className="mt-2 text-xs text-muted-foreground">Tap to change</div>
        </div>

        <Field label="Name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Alex Chen" />
        </Field>

        <Field label="Bio" hint={`${bio.length}/150`}>
          <textarea
            maxLength={150}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={inputCls}
            placeholder="Coffee snob. Weekend trekker."
          />
        </Field>

        <Field label="Date of birth">
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Gender">
          <SelectField value={gender} onChange={setGender} options={["Male", "Female", "Non-binary", "Prefer not to say"]} />
        </Field>

        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Bengaluru" />
        </Field>

        <Field label="Height (cm)" hint="optional">
          <input value={heightCm} onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={3} className={inputCls} placeholder="170" />
        </Field>

        <Field label="Profession" hint="optional">
          <input value={profession} onChange={(e) => setProfession(e.target.value)} maxLength={60} className={inputCls} placeholder="Product designer" />
        </Field>

        <Field label="Smoking" hint="optional">
          <SelectField value={smoking} onChange={setSmoking} options={["Never", "Occasionally", "Regularly", "Prefer not to say"]} />
        </Field>

        <Field label="Drinking" hint="optional">
          <SelectField value={drinking} onChange={setDrinking} options={["Never", "Socially", "Regularly", "Prefer not to say"]} />
        </Field>



        <Field label="Interests">
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const active = interests.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleInterest(i)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition ${active ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border"}`}
                >{i}</button>
              );
            })}
          </div>
        </Field>

        <Field label="Instagram" hint="optional">
          <div className="flex items-center rounded-2xl border border-input bg-background px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span className="text-muted-foreground">@</span>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              maxLength={40}
              placeholder="yourhandle"
              className="w-full bg-transparent py-3 pl-1 text-[15px] outline-none"
            />
          </div>
        </Field>

        <Field label="Spotify" hint="optional">
          <input
            value={spotify}
            onChange={(e) => setSpotify(e.target.value)}
            maxLength={200}
            placeholder="https://open.spotify.com/user/…"
            className={inputCls}
          />
        </Field>







        <div className="flex gap-3 pt-2">
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="flex-1 rounded-full border border-border bg-background py-3 text-[15px] font-medium"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-full bg-gradient-brand py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">Not set</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
