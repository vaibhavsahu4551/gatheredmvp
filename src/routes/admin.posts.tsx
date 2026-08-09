import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminListPosts, adminRemovePost, type AdminPost } from "@/lib/admin-engagement";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/posts")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ post: typeof s.post === "string" ? s.post : undefined }),
  component: AdminPosts,
});

function PostThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (/^https?:/.test(path)) { setUrl(path); return; }
    supabase.storage.from("feed-photos").createSignedUrl(path, 300).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!url) return <div className="h-14 w-14 rounded bg-muted shrink-0" />;
  return <img src={url} alt="" className="h-14 w-14 rounded object-cover shrink-0" />;
}

function AdminPosts() {
  const { post: focusId } = useSearch({ from: "/admin/posts" });
  const [rows, setRows] = useState<AdminPost[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh(search = q) {
    setLoading(true);
    try { setRows(await adminListPosts(search)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(""); }, []);

  const list = focusId ? rows.filter((r) => r.id === focusId).concat(rows.filter((r) => r.id !== focusId)) : rows;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Posts</h1>
        <p className="text-sm text-muted-foreground">Regular (non-Pride) feed posts. Removing a post also removes its likes and comments.</p>
      </div>

      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && refresh()}
          placeholder="Search caption or author…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={() => refresh()} className="rounded-lg bg-foreground text-background px-4 py-2 text-sm">Search</button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && list.length === 0 && <div className="text-sm text-muted-foreground">No posts.</div>}

      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className={`rounded-lg border p-3 flex gap-3 ${focusId === p.id ? "border-foreground" : "border-border"}`}>
            {p.photo_url ? <PostThumb path={p.photo_url} /> : <div className="h-14 w-14 rounded bg-muted shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{p.full_name ?? "Member"}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{p.caption || "—"}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {new Date(p.created_at).toLocaleString()} · {p.likes} likes · {p.comments} comments
                {p.reports > 0 && <span className="ml-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5">{p.reports} reports</span>}
                {p.kind !== "post" && <span className="ml-1 rounded-full bg-muted px-2 py-0.5">{p.kind}</span>}
              </div>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Remove this post and all its likes/comments?")) return;
                try { await adminRemovePost(p.id); toast.success("Post removed"); refresh(); }
                catch (e: any) { toast.error(e.message); }
              }}
              className="text-xs underline text-destructive self-start"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
