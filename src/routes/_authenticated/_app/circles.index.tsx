import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, ImagePlus, X } from "lucide-react";
import { createCircle, listMyCircles, signedCirclePhotoUrl, type CircleWithMeta } from "@/lib/circles";

export const Route = createFileRoute("/_authenticated/_app/circles/")({
  component: CirclesScreen,
});

function CirclesScreen() {
  const navigate = useNavigate();
  const [circles, setCircles] = useState<CircleWithMeta[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listMyCircles();
      setCircles(rows);
      const map: Record<string, string> = {};
      await Promise.all(
        rows.map(async (c) => {
          if (c.photo_path) map[c.id] = await signedCirclePhotoUrl(c.photo_path);
        }),
      );
      setPhotos(map);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load your circles");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  return (
    <div className="pb-28">
      <header className="px-5 pt-8 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Circles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your small, persistent groups — chat anytime, plan events fast.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand text-white px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </header>

      <div className="px-5 space-y-3">
        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && circles.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-12 px-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-gradient-brand-soft flex items-center justify-center">
              <Users className="h-5 w-5 text-[color:var(--brand)]" />
            </div>
            <div className="mt-3 text-sm font-semibold">No circles yet</div>
            <p className="mt-1 text-sm text-muted-foreground">Create one and invite friends with a link.</p>
            <button onClick={() => setOpen(true)} className="mt-4 rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium">
              Create a circle
            </button>
          </div>
        )}
        {circles.map((c) => (
          <Link
            key={c.id}
            to="/circles/$circleId"
            params={{ circleId: c.id }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
          >
            <div className="h-12 w-12 rounded-2xl overflow-hidden bg-gradient-brand-soft flex items-center justify-center shrink-0">
              {photos[c.id] ? (
                <img src={photos[c.id]} alt="" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-5 w-5 text-[color:var(--brand)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{c.name}</div>
              <div className="text-[12px] text-muted-foreground truncate">
                {c.member_count} member{c.member_count === 1 ? "" : "s"}
                {c.description ? ` · ${c.description}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {open && (
        <CreateCircleModal
          onClose={() => setOpen(false)}
          onCreated={(id) => navigate({ to: "/circles/$circleId", params: { circleId: id } })}
        />
      )}
    </div>
  );
}

function CreateCircleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give your circle a name");
    setSaving(true);
    try {
      const id = await createCircle({ name, description, photo });
      toast.success("Circle created");
      onCreated(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create circle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold">New circle</div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="h-16 w-16 rounded-2xl overflow-hidden bg-muted flex items-center justify-center">
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
            </div>
            <span className="text-sm text-muted-foreground">Add a circle photo (optional)</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Circle name"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What's this circle about? (optional)"
            className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary"
          />
          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-full bg-primary py-3 text-[15px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create circle"}
          </button>
        </div>
      </div>
    </div>
  );
}
