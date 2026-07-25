import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { unreadCount } from "@/lib/notifications";
import { loadMe } from "@/lib/huddl";
import { CATEGORIES, countByGender, getProfilesLite, listEvents, type EventRow, getParticipants } from "@/lib/events";
import { listFeed, getLikes, toggleLike, signedFeedUrl, getEventsLite } from "@/lib/feed";
import { loadBlockedIds } from "@/lib/safety";
import { EventCard } from "@/components/EventCard";
import { PostCard, type PostItem } from "@/components/PostCard";


export const Route = createFileRoute("/_authenticated/_app/home")({
  component: HomeFeed,
});

type EventItem = { kind: "event"; id: string; created_at: string; ev: EventRow };
type FeedItem = PostItem | EventItem;


function HomeFeed() {
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [girlsOnly, setGirlsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  useEffect(() => { unreadCount().then(setUnread).catch(() => {}); }, []);

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
      const [ev, ps, blocked] = await Promise.all([listEvents(city), listFeed(city), loadBlockedIds()]);
      const evFiltered = ev.filter((e) => !blocked.has(e.host_id));
      setEvents(evFiltered);
      const cts: typeof counts = {};
      for (const e of evFiltered) {
        const parts = await getParticipants(e.id);
        cts[e.id] = countByGender(parts);
      }
      setCounts(cts);
      setHosts(await getProfilesLite(evFiltered.map((e) => e.host_id)));

      const pItems: PostItem[] = (ps as any[])
        .filter((p) => !blocked.has(p.user_id))
        .map((p) => ({
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
        <Link to="/notifications" className="relative h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-gradient-brand text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
        </Link>
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
