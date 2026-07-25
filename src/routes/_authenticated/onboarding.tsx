import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { INTERESTS, ageFromDob, loadMe } from "@/lib/huddl";
import { toast } from "sonner";
import { X, Camera, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  useEffect(() => {
    loadMe().then((me) => {
      if (!me) return;
      setUserId(me.user.id);
      if (me.profile) {
        setFullName(me.profile.full_name ?? "");
        setDob(me.profile.dob ?? "");
        setGender(me.profile.gender ?? "");
        setCity(me.profile.city ?? "");
        setBio(me.profile.bio ?? "");
        setInterests(me.profile.interests ?? []);
        setSelfiePath(me.profile.selfie_url);
        if (me.profile.onboarding_complete) {
          navigate({ to: "/home" });
          return;
        }
      }
      setLoading(false);
    });
  }, [navigate]);

  const toggleInterest = (i: string) => {
    setInterests((s) => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
  };

  const uploadPhotos = async (files: FileList) => {
    if (photos.length + files.length > 6) return toast.error("Max 6 photos");
    const newOnes: { path: string; url: string }[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: false });
      if (error) { toast.error(error.message); continue; }
      const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(path, 3600);
      newOnes.push({ path, url: signed?.signedUrl ?? "" });
    }
    setPhotos((s) => [...s, ...newOnes]);
  };

  const removePhoto = async (path: string) => {
    await supabase.storage.from("profile-photos").remove([path]);
    setPhotos((s) => s.filter((p) => p.path !== path));
  };

  const uploadSelfie = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/selfie.${ext}`;
    const { error } = await supabase.storage.from("selfies").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    setSelfiePath(path);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!fullName.trim()) return toast.error("Add your name");
    if (!dob) return toast.error("Add your date of birth");
    if (ageFromDob(dob) < 18) return toast.error("You must be 18 or older to use HUDDL");
    if (!gender) return toast.error("Pick a gender");
    if (!city.trim()) return toast.error("Add your city");
    if (interests.length === 0) return toast.error("Pick at least one interest");
    if (photos.length < 2) return toast.error("Upload at least 2 photos");
    

    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      dob,
      gender,
      city: city.trim(),
      bio: bio.trim() || null,
      interests,
      photos: photos.map(p => p.path),
      selfie_url: selfiePath,
      onboarding_complete: true,
    }).eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    navigate({ to: "/home" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="px-6 pt-8">
        <div className="text-xs font-medium text-muted-foreground">Step 1 of 1</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set up your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">This is what other HUDDLers will see.</p>
      </header>

      <div className="mt-6 space-y-6 px-6 max-w-md mx-auto">
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Alex Chen" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date of birth">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              <option>Woman</option>
              <option>Man</option>
              <option>Non-binary</option>
              <option>Prefer not to say</option>
            </select>
          </Field>
        </div>

        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Bengaluru" />
        </Field>

        <Field label="Bio" hint={`${bio.length}/150`}>
          <textarea
            maxLength={150}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={inputCls}
            placeholder="Coffee snob. Weekend trekker. Bad at pool."
          />
        </Field>

        <Field label="Interests">
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const active = interests.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleInterest(i)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition ${active ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border"}`}
                >{i}</button>
              );
            })}
          </div>
        </Field>

        <Field label="Photos" hint={`${photos.length}/6 • min 2`}>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.path} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={p.url} className="h-full w-full object-cover" alt="" />
                <button onClick={() => removePhoto(p.path)} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/90 flex items-center justify-center shadow">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < 6 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-xs cursor-pointer hover:bg-muted">
                <Camera className="h-5 w-5 mb-1" />
                Add
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && uploadPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </Field>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-full bg-primary py-3.5 text-[15px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & continue"}
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
