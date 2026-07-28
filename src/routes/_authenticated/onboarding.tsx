import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, signedPhotoUrl } from "@/lib/huddl";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

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
      const ext = (toUpload.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
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

  const submit = async () => {
    if (!photoPath) return toast.error("Add a profile photo");
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      photos: [photoPath],
      onboarding_complete: true,
    }, { onConflict: "id" });
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

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="px-6 pt-8 max-w-md mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Add a profile photo</h1>
        <p className="mt-1 text-sm text-muted-foreground">You can add your name, bio and interests later from your profile.</p>
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
              if (f) uploadPhoto(f);
            }}
          />
        </label>
        {photoPreview && !uploading && <div className="mt-4 text-xs text-muted-foreground">Tap the photo to replace</div>}
        {uploading && <div className="mt-4 text-xs text-muted-foreground">Uploading photo…</div>}

        <button
          onClick={submit}
          disabled={saving || uploading || !photoPath}
          className="mt-8 w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white shadow-elevated disabled:opacity-50"
        >
          {saving ? "Saving…" : uploading ? "Uploading…" : photoPath ? "Continue" : "Add a photo to continue"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={submit}
            disabled={saving || uploading || !photoPath}
            className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : uploading ? "Uploading…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
