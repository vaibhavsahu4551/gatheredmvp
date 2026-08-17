import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminListStories, adminDeleteStory, type AdminStory } from "@/lib/admin-content";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/stories")({
  component: AdminStories,
});

function AdminStories() {
  const [rows, setRows] = useState<AdminStory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh(q = search) {
    setLoading(true);
    try { setRows(await adminListStories(q)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(""); }, []);

  async function remove(s: AdminStory) {
    if (!confirm("Remove this story? This cannot be undone.")) return;
    try { await adminDeleteStory(s.id); toast.success("Story removed"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Stories</h1>
          <p className="text-xs text-muted-foreground">Active stories only. Pride stories are never shown here.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); refresh(); }} className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search author…"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button className="rounded-lg bg-foreground text-background px-3 py-2 text-sm">Search</button>
        </form>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No active stories.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows.map((s) => (
            <div key={s.id} className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="aspect-[9/16] bg-muted flex items-center justify-center text-[11px] text-muted-foreground p-2 text-center">
                {s.media_type?.startsWith("video") ? "Video story" : "Image story"}
                {s.text_overlay ? <span className="block mt-1 italic">“{s.text_overlay}”</span> : null}
              </div>
              <div className="p-3 space-y-1">
                <div className="text-sm font-medium truncate">{s.author_name ?? "Unknown"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.views} views · {s.reports} reports
                </div>
                <div className="text-[10px] text-muted-foreground">
                  expires {new Date(s.expires_at).toLocaleString()}
                </div>
                <button onClick={() => remove(s)} className="mt-1 text-xs underline text-destructive">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
