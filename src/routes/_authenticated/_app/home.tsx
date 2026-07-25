import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, ShieldCheck } from "lucide-react";
import { loadMe } from "@/lib/huddl";
import { CATEGORIES, countByGender, getProfilesLite, listEvents, type EventRow, getParticipants } from "@/lib/events";
import { listFeed, getLikes, toggleLike, signedFeedUrl } from "@/lib/feed";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageSquare, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/home")({
  component: HomeFeed,
});

function HomeFeed() {
  const [tab, setTab] = useState<"events" | "feed">("events");
  const [city, setCity] = useState("");

  useEffect(() => {
    loadMe().then((me) => setCity(me?.profile?.city ?? ""));
  }, []);

  return (
    <div>
      <header className="px-5 pt-8 pb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{city || "—"}</div>
          <h1 className="text-2xl font-semibold tracking-tight">Happening near you</h1>
        </div>
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Search className="h-5 w-5" />
        </div>
      </header>

      <div className="px-5 pb-3">
        <div className="inline-flex rounded-full border border-border p-0.5 text-sm">
          {(["events","feed"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full font-medium transition ${tab === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {t === "events" ? "Events" : "Feed"}
            </button>
          ))}
        </div>
      </div>

      {tab === "events" ? <EventsList city={city} /> : <FeedList city={city} />}
    </div>
  );
}

function EventsList({ city }: { city: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { boys: number; girls: number; total: number }>>({});
  const [hosts, setHosts] = useState<Record<string, { full_name: string | null; gender: string | null }>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [girlsOnly, setGirlsOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    listEvents(city).then(async (ev) => {
      setEvents(ev);
      const cts: typeof counts = {};
      for (const e of ev) {
        const parts = await getParticipants(e.id);
        cts[e.id] = countByGender(parts);
      }
      setCounts(cts);
      const hostMap = await getProfilesLite(ev.map((e) => e.host_id));
      setHosts(hostMap);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [city]);

  const filtered = useMemo(() => events.filter((e) => {
    if (cat !== "All" && e.category !== cat) return false;
    if (girlsOnly && !(e.min_girls && e.min_girls > 0)) return false;
    if (q && !e.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [events, cat, girlsOnly, q]);

  return (
    <div>
      <div className="px-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…"
          className="w-full rounded-full border border-border bg-muted/40 px-4 py-2 text-sm" />
      </div>
      <div className="px-5 mt-3 flex gap-2 overflow-x-auto pb-2">
        {["All", ...CATEGORIES].map((t) => (
          <button key={t} onClick={() => setCat(t)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border ${cat === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>{t}</button>
        ))}
        <button onClick={() => setGirlsOnly((v) => !v)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border ${girlsOnly ? "bg-pink-500 text-white border-pink-500" : "border-border text-muted-foreground"}`}>♀ preferred</button>
      </div>

      <div className="mt-3 px-5 space-y-3 pb-4">
        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">No events in {city || "your city"} yet. Be the first to create one.</div>
        )}
        {filtered.map((e) => {
          const c = counts[e.id] ?? { boys: 0, girls: 0, total: 0 };
          const host = hosts[e.host_id];
          return (
            <Link key={e.id} to="/events/$eventId" params={{ eventId: e.id }}
              className="block rounded-2xl border border-border p-4 bg-card">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {e.event_type && (
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{e.event_type}</span>
                  )}
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">{e.category}</span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{new Date(e.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <h3 className="mt-1.5 text-[17px] font-semibold leading-snug">{e.title}</h3>
              <div className="mt-1 text-[13px] text-muted-foreground">{e.location_address}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-primary" /> {host?.full_name ?? "Host"}
                {e.status === "confirmed" && <span className="ml-auto rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">Confirmed</span>}
                {e.status === "pending" && <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">Filling up</span>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {c.boys} boys, {c.girls} girls joined / max {e.max_size}
                </div>
                <div className="rounded-full bg-foreground text-background text-[13px] font-medium px-4 py-1.5">Open</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function FeedList({ city }: { city: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<{ counts: Record<string, number>; mine: Set<string> }>({ counts: {}, mine: new Set() });
  const [names, setNames] = useState<Record<string, { full_name: string | null }>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  const refresh = async () => {
    if (!city) return;
    const ps = await listFeed(city);
    setPosts(ps);
    const l = await getLikes(ps.map((p) => p.id));
    setLikes(l);
    const n = await getProfilesLite(ps.map((p) => p.user_id));
    setNames(n);
    const im: Record<string, string> = {};
    for (const p of ps) if (p.photo_url) im[p.id] = await signedFeedUrl(p.photo_url);
    setImgs(im);
  };
  useEffect(() => { refresh(); }, [city]);

  const post = async () => {
    if (!caption.trim() && !file) return;
    setPosting(true);
    try {
      const { createPost } = await import("@/lib/feed");
      await createPost(city, caption.trim(), file ?? undefined);
      setCaption(""); setFile(null); setComposerOpen(false);
      await refresh();
    } finally { setPosting(false); }
  };

  return (
    <div className="px-5 pb-4 space-y-3">
      <button onClick={() => setComposerOpen((v) => !v)} className="w-full rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Share something with {city || "your city"}
      </button>

      {composerOpen && (
        <div className="rounded-2xl border border-border p-3 space-y-2">
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={280} placeholder="What's up?" className="w-full text-sm outline-none resize-none" />
          <div className="flex items-center justify-between">
            <label className="text-xs text-primary cursor-pointer">
              {file ? file.name : "Add photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button onClick={post} disabled={posting} className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium disabled:opacity-50">Post</button>
          </div>
        </div>
      )}

      {posts.length === 0 && <div className="text-sm text-muted-foreground text-center py-12">No posts yet.</div>}
      {posts.map((p) => (
        <PostCard key={p.id} p={p} img={imgs[p.id]} name={names[p.user_id]?.full_name ?? "Someone"}
          liked={likes.mine.has(p.id)} likeCount={likes.counts[p.id] ?? 0}
          onLike={async () => { await toggleLike(p.id); await refresh(); }} />
      ))}
    </div>
  );
}

function PostCard({ p, img, name, liked, likeCount, onLike }: any) {
  const [openC, setOpenC] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");

  const load = async () => {
    const { listComments } = await import("@/lib/feed");
    setComments(await listComments(p.id));
  };
  const submit = async () => {
    if (!text.trim()) return;
    const { addComment } = await import("@/lib/feed");
    await addComment(p.id, text.trim()); setText(""); await load();
  };

  return (
    <article className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 text-[13px] font-medium">{name}</div>
      {img && <img src={img} className="w-full aspect-square object-cover" alt="" />}
      {p.caption && <div className="px-3 pt-2 text-[14px]">{p.caption}</div>}
      <div className="px-3 py-2 flex items-center gap-4 text-sm">
        <button onClick={onLike} className="flex items-center gap-1.5">
          <Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : ""}`} /> {likeCount}
        </button>
        <button onClick={() => { setOpenC((v) => !v); if (!openC) load(); }} className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" /> Comments
        </button>
      </div>
      {openC && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {comments.map((c) => <div key={c.id} className="text-[13px]"><span className="font-medium">Guest</span> {c.body}</div>)}
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 rounded-full border border-border px-3 py-1.5 text-sm" />
            <button onClick={submit} className="rounded-full bg-primary text-primary-foreground px-3 text-sm">Send</button>
          </div>
        </div>
      )}
    </article>
  );
}
