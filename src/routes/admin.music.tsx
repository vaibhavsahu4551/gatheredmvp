import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminListTracks, adminCreateTrack, adminUpdateTrack, adminDeleteTrack,
  uploadTrackFile, type MusicTrack,
} from "@/lib/admin-content";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/music")({
  component: AdminMusic,
});

const CATEGORIES = ["Chill", "Upbeat", "Party", "Acoustic", "Cinematic", "Other"];

function AdminMusic() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    try { setTracks(await adminListTracks()); } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Music library</h1>
          <p className="text-xs text-muted-foreground">Tracks available in the Story music picker.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">
          {showForm ? "Cancel" : "Add track"}
        </button>
      </div>

      {showForm && <TrackForm onSaved={() => { setShowForm(false); refresh(); }} />}

      <div className="space-y-2">
        {tracks.map((t) => (
          <div key={t.id} className="rounded-lg border border-border p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.title}</div>
              <div className="text-xs text-muted-foreground truncate">{t.artist} · {t.category} · {t.license}</div>
              {t.url && <audio src={t.url} controls preload="none" className="mt-2 h-8 w-full max-w-xs" />}
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <button onClick={() => adminUpdateTrack(t.id, { active: !t.active }).then(refresh).catch((e) => toast.error(e.message))} className="underline">
                {t.active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => confirm("Delete track?") && adminDeleteTrack(t.id, t.storage_path).then(refresh).catch((e) => toast.error(e.message))} className="underline text-destructive">
                Delete
              </button>
            </div>
          </div>
        ))}
        {tracks.length === 0 && <div className="text-xs text-muted-foreground">No tracks yet.</div>}
      </div>
    </div>
  );
}

function TrackForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [category, setCategory] = useState("Chill");
  const [license, setLicense] = useState("CC BY 4.0");
  const [attribution, setAttribution] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let finalUrl = url.trim();
      let storagePath: string | null = null;
      if (file) {
        const up = await uploadTrackFile(file);
        finalUrl = up.url; storagePath = up.path;
      }
      if (!finalUrl) throw new Error("Provide an audio file or a URL.");
      await adminCreateTrack({ title, artist, category, license, attribution: attribution || null, url: finalUrl, storage_path: storagePath, active: true });
      toast.success("Track added");
      onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">Title
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs">Artist
          <input required value={artist} onChange={(e) => setArtist(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs">Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-xs">License
          <input value={license} onChange={(e) => setLicense(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-xs">Attribution (optional)
        <input value={attribution} onChange={(e) => setAttribution(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-xs">Audio file (mp3)
        <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm" />
      </label>
      <label className="block text-xs">…or external URL
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="https://…" />
      </label>
      <button disabled={busy} className="rounded-lg bg-foreground text-background px-4 py-2 text-sm">
        {busy ? "Saving…" : "Add track"}
      </button>
    </form>
  );
}
