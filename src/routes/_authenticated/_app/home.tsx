import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, ShieldCheck, Heart, MessageSquare, Link2 } from "lucide-react";
import { loadMe } from "@/lib/huddl";
import { CATEGORIES, countByGender, getProfilesLite, listEvents, type EventRow, getParticipants } from "@/lib/events";
import { listFeed, getLikes, toggleLike, signedFeedUrl, getEventsLite } from "@/lib/feed";

export const Route = createFileRoute("/_authenticated/_app/home")({
  component: HomeFeed,
});

type PostItem = {
  kind: "post";
  id: string;
  created_at: string;
  user_id: string;
  caption: string | null;
  photo_url: string | null;
  event_id: string | null;
};
type EventItem = { kind: "event"; id: string; created_at: string; ev: EventRow };
type FeedItem = PostItem | EventItem;

function HomeFeed() {
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [girlsOnly, setGirlsOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { boys: number; girls: number; total: number }>>({});
  const [hosts, setHosts] = useState<Record<string, { full_name: string | null; gender: string | null }>>({});

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<{ counts: Record<string, number>; mine: Set<string> }>({ counts: {}, mine: new Set() });
  const [names, setNames] = useState<Record<string, { full_name: string | null }>>({});
  const [linkedEvents, setLinkedEvents] = useState<Record<string, { id: string; title: string; event_type: string | null }>>({});

  useEffect(() => {
    loadMe().then((me) => setCity(me?.profile?.city ?? ""));
  }, []);

  const refresh = async () => {
    if (!city) return;
    setLoading(true);
    try {
      const [ev, ps] = await Promise.all([listEvents(city), listFeed(city)]);
      setEvents(ev);
      const cts: typeof counts = {};
      for (const e of ev) {
        const parts = await getParticipants(e.id);
        cts[e.id] = countByGender(parts);
      }
      setCounts(cts);
      setHosts(await getProfilesLite(ev.map((e) => e.host_id)));

      const pItems: PostItem[] = (ps as any[]).map((p) => ({
        kind: "post", id: p.id, created_at: p.created_at, user_id: p.user_id,
        caption: p.caption, photo_url: p.photo_url, event_id: p.event_id ?? null,
      }));
      setPosts(pItems);
      const [l, n, evMap] = await Promise.all([
        getLikes(pItems.map((p) => p.id)),
        getProfilesLite(pItems.map((p) => p.user_id)),
        getEventsLite(pItems.map((p) => p.event_id ?? "")),
      ]);
      setLikes(l); setNames(n); setLinkedEvents(evMap);
      const im: Record<string, string> = {};
      for (const p of pItems) if (p.photo_url) im[p.id] = await signedFeedUrl(p.photo_url);
      setImgs(im);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [city]);

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (cat !== "All" && e.category !== cat) return false;
    if (girlsOnly && !(e.min_girls && e.min_girls > 0)) return false;
    if (q && !e.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [events, cat, girlsOnly, q]);

  const filteredPosts = useMemo(() => posts.filter((p) => {
    if (cat !== "All") return false; // hide posts when filtering by event category
    if (girlsOnly) return false;
    if (q && !(p.caption ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [posts, cat, girlsOnly, q]);

  const items: FeedItem[] = useMemo(() => {
    const arr: FeedItem[] = [
      ...filteredEvents.map<EventItem>((e) => ({ kind: "event", id: e.id, created_at: e.created_at ?? e.starts_at, ev: e })),
      ...filteredPosts,
    ];
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return arr;
  }, [filteredEvents, filteredPosts]);

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

      <div className="px-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events and posts…"
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
        {!loading && items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">Nothing here yet in {city || "your city"}. Create the first event or post.</div>
        )}
        {items.map((it) => it.kind === "event" ? (
          <EventCard key={"e" + it.id} e={it.ev} c={counts[it.id] ?? { boys: 0, girls: 0, total: 0 }} host={hosts[it.ev.host_id]} />
        ) : (
          <PostCard key={"p" + it.id} p={it} img={imgs[it.id]} name={names[it.user_id]?.full_name ?? "Someone"}
            linked={it.event_id ? linkedEvents[it.event_id] : undefined}
            liked={likes.mine.has(it.id)} likeCount={likes.counts[it.id] ?? 0}
            onLike={async () => { await toggleLike(it.id); await refresh(); }} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ e, c, host }: { e: EventRow; c: { boys: number; girls: number; total: number }; host?: { full_name: string | null } }) {
  return (
    <Link to="/events/$eventId" params={{ eventId: e.id }}
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
}

function PostCard({ p, img, name, linked, liked, likeCount, onLike }: {
  p: PostItem; img?: string; name: string;
  linked?: { id: string; title: string; event_type: string | null };
  liked: boolean; likeCount: number; onLike: () => void;
}) {
  const navigate = useNavigate();
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
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
        <div className="text-[13px] font-medium">{name}</div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Post</span>
      </div>
      {img && <img src={img} className="w-full aspect-square object-cover" alt="" />}
      {p.caption && <div className="px-3 pt-2 text-[14px] whitespace-pre-wrap">{p.caption}</div>}
      {linked && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate({ to: "/events/$eventId", params: { eventId: linked.id } }); }}
          className="mx-3 mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[12px] font-medium"
        >
          <Link2 className="h-3 w-3" />
          {linked.event_type ? `${linked.event_type} at ${linked.title}` : linked.title}
        </button>
      )}
      <div className="px-3 py-2 mt-1 flex items-center gap-4 text-sm">
        <button onClick={onLike} className="flex items-center gap-1.5">
          <Heart className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : ""}`} /> {likeCount}
        </button>
        <button onClick={() => { setOpenC((v) => !v); if (!openC) load(); }} className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" /> Comments
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
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
