import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, signedPhotoUrl } from "@/lib/huddl";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  useEffect(() => {
    loadMe().then(async (me) => {
      if (!me) return;
      setUserId(me.user.id);
      if (me.profile?.onboarding_complete) {
        navigate({ to: "/home" });
        return;
      }
      const existing = me.profile?.photos?.[0];
      if (existing) {
        setPhotoPath(existing);
        setPhotoPreview(await signedPhotoUrl(existing));
      }
      setLoading(false);
    });
  }, [navigate]);

  const uploadPhoto = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: false });
    if (error) return toast.error(error.message);
    if (photoPath) await supabase.storage.from("profile-photos").remove([photoPath]);
    setPhotoPath(path);
    setPhotoPreview(URL.createObjectURL(file));
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
    toast.success("Welcome to HUDDL");
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
        <label className="relative h-40 w-40 rounded-full bg-muted overflow-hidden cursor-pointer flex items-center justify-center shadow-elevated">
          {photoPreview ? (
            <img src={photoPreview} className="h-full w-full object-cover" alt="" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <Camera className="h-8 w-8 mb-1" />
              <span className="text-xs">Tap to add</span>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
        </label>
        {photoPreview && <div className="mt-4 text-xs text-muted-foreground">Tap the photo to replace</div>}

        <button
          onClick={submit}
          disabled={saving || !photoPath}
          className="mt-8 w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white shadow-elevated disabled:opacity-50"
        >
          {saving ? "Saving…" : photoPath ? "Continue" : "Add a photo to continue"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={submit}
            disabled={saving || !photoPath}
            className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
