import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Camera, ShieldAlert, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { loadMe } from "@/lib/huddl";
import {
  loadMyPrideProfile,
  moderateAndUploadPridePhoto,
  savePrideProfile,
  signedPridePhotoUrl,
} from "@/lib/pride";

export const Route = createFileRoute("/_authenticated/_app/pride/setup")({
  component: PrideSetup,
});

function PrideSetup() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await loadMe();
      if (!me?.profile?.pride_opt_in) {
        navigate({ to: "/home", replace: true });
        return;
      }
      const existing = await loadMyPrideProfile();
      if (existing) {
        setDisplayName(existing.display_name);
        setBio(existing.bio ?? "");
        setPhotoPath(existing.photo_path);
        if (existing.photo_path) setPreview(await signedPridePhotoUrl(existing.photo_path));
      }
      setReady(true);
    })();
  }, [navigate]);

  const onPhoto = async (file: File) => {
    setUploading(true);
    try {
      const path = await moderateAndUploadPridePhoto(file);
      setPhotoPath(path);
      setPreview(await signedPridePhotoUrl(path));
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload photo");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!displayName.trim()) return toast.error("Choose a display name");
    setSaving(true);
    try {
      await savePrideProfile({ display_name: displayName, bio, photo_path: photoPath });
      toast.success("Pride identity saved");
      navigate({ to: "/pride" });
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold tracking-tight flex-1">Your Pride identity</h1>
      </header>

      <div className="px-5 pt-6 max-w-md mx-auto space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-500 p-4 text-white shadow-glow">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" /> A private, separate identity
          </div>
          <p className="mt-1 text-xs opacity-90">
            This name and photo are shown only inside Pride. They are never linked to your main
            profile, and no other user or admin can see the connection.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <label className="relative h-32 w-32 rounded-full bg-muted overflow-hidden cursor-pointer flex items-center justify-center shadow-elevated">
            {preview ? (
              <img src={preview} className="h-full w-full object-cover" alt="" />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-xs">{uploading ? "Checking…" : "Add photo"}</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
            />
          </label>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Separate from your main profile photo
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="A name you want to be known by in Pride"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Don't use your real name.</p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label className="text-sm font-medium">Short bio (optional)</label>
            <span className="text-xs text-muted-foreground">{bio.length}/200</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="A vibe for the Pride community"
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-3 text-[12px] flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
          <div>
            <div className="font-semibold text-foreground">Community rules</div>
            No nudity or sexually explicit content. Every photo you upload here is automatically
            checked. Violations are blocked, logged, and repeated violations suspend Pride access.
          </div>
        </div>

        <button
          onClick={submit}
          disabled={saving || uploading || !displayName.trim()}
          className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Pride identity"}
        </button>
      </div>
    </div>
  );
}
