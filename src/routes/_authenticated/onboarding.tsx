import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, signedPhotoUrl } from "@/lib/huddl";
import { compressImage } from "@/lib/image-compress";
import { normalizeHandle, normalizeSpotify } from "@/lib/socials";
import { PhotoCropModal } from "@/components/PhotoCropModal";
import { toast } from "sonner";
import { Camera, Instagram, Loader2, Music2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
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
        const existing = me.profile?.photos?.[0];
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
      if (prev) {
        supabase.storage.from("profile-photos").remove([prev]).catch(() => {});
      }
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
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
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
    toast.success("Welcome to Gathr");
    navigate({ to: "/home" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <header className="px-6 pt-8 max-w-md mx-auto">
          <div className="text-xs font-medium text-muted-foreground">Step 2 of 2</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add your socials (optional)</h1>
          <p className="mt-1 text-sm text-muted-foreground">These show as tappable links on your profile. You can add or change them anytime.</p>
        </header>

        <div className="mt-8 px-6 max-w-md mx-auto space-y-5">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium"><Instagram className="h-4 w-4" /> Instagram</label>
            <div className="flex items-center rounded-2xl border border-input bg-background px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <span className="text-muted-foreground">@</span>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="yourhandle"
                maxLength={40}
                className="w-full bg-transparent py-3 pl-1 text-[15px] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium"><Music2 className="h-4 w-4" /> Spotify</label>
            <input
              value={spotify}
              onChange={(e) => setSpotify(e.target.value)}
              placeholder="https://open.spotify.com/user/…"
              maxLength={200}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={() => finish(true)}
            disabled={saving}
            className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white shadow-elevated disabled:opacity-50"
          >
            {saving ? "Saving…" : "Finish"}
          </button>
          <button
            onClick={() => finish(false)}
            disabled={saving}
            className="w-full rounded-full border border-border bg-background py-3.5 text-[15px] font-medium disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
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

      <header className="px-6 pt-8 max-w-md mx-auto">
        <div className="text-xs font-medium text-muted-foreground">Step 1 of 2</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add a profile photo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a photo, then zoom and drag to frame it. You can add your name, bio and interests later.</p>
      </header>

      <div className="mt-8 px-6 max-w-md mx-auto flex flex-col items-center">
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
        {uploading && <div className="mt-4 text-xs text-muted-foreground">Uploading photo…</div>}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => (photoPath ? setStep(2) : toast.error("Add a profile photo"))}
            disabled={uploading || !photoPath}
            className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {uploading ? "Uploading…" : photoPath ? "Continue" : "Add a photo to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
