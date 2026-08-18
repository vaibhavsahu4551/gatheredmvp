import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { unreadCount } from "@/lib/notifications";
import { loadMe } from "@/lib/huddl";
import { EVENT_TYPES, countByGender, getProfilesLite, listEvents, type EventRow, getParticipantsForEvents } from "@/lib/events";
import { listFeed, getLikes, toggleLike, signedFeedUrl, getEventsLite } from "@/lib/feed";
import { loadBlockedIds } from "@/lib/safety";
import { EventCard } from "@/components/EventCard";
import { PostCard, type PostItem } from "@/components/PostCard";
import { CityPickerModal } from "@/components/CityPickerModal";
import { getActiveBanner, getAppSettings, type HomeBanner } from "@/lib/admin";
import { getMyEntitlements, getUserTiers } from "@/lib/entitlements";
import { getVerifiedIds } from "@/lib/verification";
import { sortEventsByStatus } from "@/lib/event-status";

import { UpgradePrompt } from "@/components/UpgradePrompt";
import { StoryRail } from "@/components/StoryRail";
import { PeopleSuggestions } from "@/components/PeopleSuggestions";
import { IcebreakerCard } from "@/components/IcebreakerCard";
import { WeeklyChallengeCard } from "@/components/WeeklyChallengeCard";
import { Lock } from "lucide-react";


export const Route = createFileRoute("/_authenticated/_app/home")({
  component: HomeFeed,
});

type EventItem = { kind: "event"; id: string; created_at: string; ev: EventRow };
type FeedItem = PostItem | EventItem;

const POSTS_PAGE = 10;

function HomeFeed() {
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [girlsOnly, setGirlsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [banner, setBanner] = useState<HomeBanner | null>(null);
  const [premium, setPremium] = useState(false);
  useEffect(() => { unreadCount().then(setUnread).catch(() => {}); }, []);
  useEffect(() => {
    getActiveBanner().then(setBanner).catch(() => {});
    getAppSettings().then((s) => setPremium(s.subscription_enabled)).catch(() => {});
  }, []);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { boys: number; girls: number; total: number }>>({});
  const [hosts, setHosts] = useState<Record<string, { full_name: string | null; gender: string | null; created_at?: string | null }>>({});
  const [hostTiers, setHostTiers] = useState<Record<string, "free" | "premium">>({});
  const [verifiedHosts, setVerifiedHosts] = useState<Set<string>>(new Set());
  const [hasPremium, setHasPremium] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  useEffect(() => { getMyEntitlements().then((e) => setHasPremium(e.hasAccess)); }, []);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsOffset, setPostsOffset] = useState(0);
  const [postsDone, setPostsDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<{ counts: Record<string, number>; mine: Set<string> }>({ counts: {}, mine: new Set() });
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [linkedEvents, setLinkedEvents] = useState<Record<string, { id: string; title: string; event_type: string | null }>>({});
  const [prompts, setPrompts] = useState<Record<string, string>>({});

  const meIdRef = useRef<string>("");
  const blockedRef = useRef<Set<string>>(new Set());

  const [cityModal, setCityModal] = useState(false);
  const [locState, setLocState] = useState<"idle" | "detecting" | "denied">("idle");
  useEffect(() => {
    loadMe().then((me) => {
      const saved = me?.profile?.city ?? "";
      if (saved) { setCity(saved); return; }
      if (!("geolocation" in navigator)) { setLocState("denied"); return; }
      setLocState("detecting");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=10`, { headers: { Accept: "application/json" } });
            const j = await r.json();
            const a = j?.address ?? {};
            const detected = a.city || a.town || a.village || a.municipality || a.county || a.state || "";
            if (detected) { setCity(detected); setLocState("idle"); } else { setLocState("denied"); }
          } catch { setLocState("denied"); }
        },
        () => setLocState("denied"),
        { timeout: 8000, maximumAge: 600000 }
      );
    });
  }, []);

  // Hydrate a batch of posts (profiles, likes, linked events, signed image URLs) in parallel.
  const hydratePosts = useCallback(async (batch: PostItem[]) => {
    if (!batch.length) return;
    const { getPromptsLite } = await import("@/lib/icebreakers");
    const [l, n, evMap, promptMap, imgPairs] = await Promise.all([
      getLikes(batch.map((p) => p.id)),
      getProfilesLite(batch.map((p) => p.user_id)),
      getEventsLite(batch.map((p) => p.event_id ?? "").filter(Boolean)),
      getPromptsLite(batch.map((p) => p.prompt_id ?? "").filter(Boolean)),
      Promise.all(
        batch.filter((p) => p.photo_url).map(async (p) => [p.id, await signedFeedUrl(p.photo_url!)] as const),
      ),
    ]);
    setLikes((prev) => ({
      counts: { ...prev.counts, ...l.counts },
      mine: new Set([...prev.mine, ...l.mine]),
    }));
    setNames((prev) => ({ ...prev, ...n }));
    setLinkedEvents((prev) => ({ ...prev, ...evMap }));
    setPrompts((prev) => ({ ...prev, ...promptMap }));
    setImgs((prev) => {
      const next = { ...prev };
      for (const [id, url] of imgPairs) next[id] = url;
      return next;
    });
  }, []);

  const [err, setErr] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: { user } }, ev, firstPosts, blocked] = await Promise.all([
        supabase.auth.getUser(),
        listEvents(),
        listFeed({ limit: POSTS_PAGE, offset: 0 }),
        loadBlockedIds(),
      ]);
      const meId = user?.id ?? "";
      meIdRef.current = meId;
      blockedRef.current = blocked;

      const evFiltered = ev.filter((e) => !blocked.has(e.host_id) && e.host_id !== meId);
      setEvents(evFiltered);

      // Batched participants + hosts in parallel — was N+1 before.
      const [partsMap, hostsMap] = await Promise.all([
        getParticipantsForEvents(evFiltered.map((e) => e.id)),
        getProfilesLite(evFiltered.map((e) => e.host_id)),
      ]);
      const cts: typeof counts = {};
      for (const e of evFiltered) cts[e.id] = countByGender(partsMap[e.id] ?? []);
      setCounts(cts);
      setHosts(hostsMap);
      setHostTiers(await getUserTiers(evFiltered.map((e) => e.host_id)));
      setVerifiedHosts(await getVerifiedIds(evFiltered.map((e) => e.host_id)));

      const pItems: PostItem[] = (firstPosts as any[])
        .filter((p) => !blocked.has(p.user_id) && p.user_id !== meId)
        .map((p) => ({
          kind: "post", id: p.id, created_at: p.created_at, user_id: p.user_id,
          caption: p.caption, photo_url: p.photo_url, event_id: p.event_id ?? null,
          prompt_id: p.prompt_id ?? null,
        }));
      setPosts(pItems);
      setPostsOffset(firstPosts.length);
      setPostsDone(firstPosts.length < POSTS_PAGE);
      await hydratePosts(pItems);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load feed");
    } finally { setLoading(false); }
  }, [hydratePosts]);
  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loadingMore || postsDone) return;
    setLoadingMore(true);
    try {
      const raw = await listFeed({ limit: POSTS_PAGE, offset: postsOffset });
      const meId = meIdRef.current;
      const blocked = blockedRef.current;
      const batch: PostItem[] = (raw as any[])
        .filter((p) => !blocked.has(p.user_id) && p.user_id !== meId)
        .map((p) => ({
          kind: "post", id: p.id, created_at: p.created_at, user_id: p.user_id,
          caption: p.caption, photo_url: p.photo_url, event_id: p.event_id ?? null,
          prompt_id: p.prompt_id ?? null,
        }));
      setPosts((prev) => [...prev, ...batch]);
      setPostsOffset((n) => n + raw.length);
      if (raw.length < POSTS_PAGE) setPostsDone(true);
      await hydratePosts(batch);
    } finally { setLoadingMore(false); }
  }, [loadingMore, postsDone, postsOffset, hydratePosts]);

  // Infinite scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Optimistic like — no full-feed refresh.
  const onLike = useCallback(async (postId: string) => {
    setLikes((prev) => {
      const mine = new Set(prev.mine);
      const counts = { ...prev.counts };
      if (mine.has(postId)) { mine.delete(postId); counts[postId] = Math.max(0, (counts[postId] ?? 1) - 1); }
      else { mine.add(postId); counts[postId] = (counts[postId] ?? 0) + 1; }
      return { counts, mine };
    });
    try { await toggleLike(postId); } catch { /* re-fetch just this post's likes on failure */
      const l = await getLikes([postId]);
      setLikes((prev) => ({
        counts: { ...prev.counts, [postId]: l.counts[postId] ?? 0 },
        mine: (() => { const m = new Set(prev.mine); l.mine.has(postId) ? m.add(postId) : m.delete(postId); return m; })(),
      }));
    }
  }, []);

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (cat !== "All" && e.event_type !== cat) return false;
    if (girlsOnly && !(e.min_girls && e.min_girls > 0)) return false;
    if (q && !e.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [events, cat, girlsOnly, q]);

  const filteredPosts = useMemo(() => posts.filter((p) => {
    if (cat !== "All") return false;
    if (girlsOnly) return false;
    if (q && !(p.caption ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [posts, cat, girlsOnly, q]);

  const items: FeedItem[] = useMemo(() => {
    // Events first, grouped by status: Open → Filling up → Closed (recency within each).
    const sortedEvents = sortEventsByStatus(filteredEvents, counts);
    const posts = [...filteredPosts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return [
      ...sortedEvents.map<EventItem>((e) => ({ kind: "event", id: e.id, created_at: e.created_at ?? e.starts_at, ev: e })),
      ...posts,
    ];
  }, [filteredEvents, filteredPosts, counts]);

  return (
    <div>
      <header className="px-5 pt-8 pb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {city ? (
              <button onClick={() => setCityModal(true)} className="text-left">
                📍 Showing events near <span className="text-foreground font-semibold underline">{city}</span>
              </button>
            ) : locState === "detecting" ? (
              <span>📍 Detecting your location…</span>
            ) : (
              <button onClick={() => setCityModal(true)} className="underline text-primary">📍 Set your location</button>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Happening near you</h1>
        </div>
        <Link to="/notifications" className="relative h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-gradient-brand text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
        </Link>
      </header>
      <StoryRail />
      <PeopleSuggestions />

      <div className="px-5 mt-3">

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events and posts…"
          className="w-full rounded-full border border-border bg-muted/40 px-4 py-2 text-sm" />
      </div>
      <div className="px-5 mt-3 flex gap-2 overflow-x-auto pb-2">
        {["All", ...EVENT_TYPES].map((t) => (
          <button key={t} onClick={() => setCat(t)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border ${cat === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>{t}</button>
        ))}
        <button onClick={() => setGirlsOnly((v) => !v)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border ${girlsOnly ? "bg-pink-500 text-white border-pink-500" : "border-border text-muted-foreground"}`}>♀ preferred</button>
        <button onClick={() => { if (!hasPremium) setAdvOpen(true); }}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border border-border text-muted-foreground inline-flex items-center gap-1">
          {!hasPremium && <Lock className="h-3 w-3" />} Age & distance
        </button>
      </div>


      <div className="mt-3 px-5 space-y-3 pb-4">
        <IcebreakerCard city={city} />
        <WeeklyChallengeCard />
        {banner && (
          <div className="rounded-2xl overflow-hidden border border-border bg-gradient-brand text-white shadow-sm">
            {banner.image_url && <img src={banner.image_url} alt="" className="w-full h-32 object-cover" />}
            <div className="p-4">
              <div className="text-sm font-semibold">{banner.title}</div>
              {banner.body && <div className="text-xs opacity-90 mt-1">{banner.body}</div>}
              {banner.event_id && (
                <Link to="/events/$eventId" params={{ eventId: banner.event_id }} className="inline-block mt-2 text-xs font-medium underline">
                  View event →
                </Link>
              )}
            </div>
          </div>
        )}
        <Link to="/discover" className="block rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-brand flex items-center justify-center text-white">✨</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Discover by Interest</div>
              <div className="text-xs text-muted-foreground">Find people who share your vibe</div>
            </div>
            <span className="text-gradient-brand text-lg">→</span>
          </div>
        </Link>
        {premium && (
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-brand flex items-center justify-center text-white text-lg">✨</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Gathr Premium</div>
              <div className="text-xs text-muted-foreground">Unlock priority events and more.</div>
            </div>
            <Link to="/premium" className="rounded-full bg-foreground text-background text-xs font-medium px-3 py-1.5">Upgrade</Link>
          </div>
        )}
        {loading && <FeedSkeleton />}
        {!loading && err && (
          <div className="text-center py-8 space-y-3">
            <div className="text-sm text-destructive">{err}</div>
            <button onClick={refresh} className="rounded-full bg-gradient-brand text-white px-4 py-2 text-sm font-medium">Retry</button>
          </div>
        )}
        {!loading && !err && items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">Nothing here yet in {city || "your city"}. Create the first event or post.</div>
        )}
        {items.map((it) => it.kind === "event" ? (
          <EventCard key={"e" + it.id} e={it.ev} c={counts[it.id] ?? { boys: 0, girls: 0, total: 0 }} host={hosts[it.ev.host_id]} hostPremium={hostTiers[it.ev.host_id] === "premium"} hostVerified={verifiedHosts.has(it.ev.host_id)} />
        ) : (
          <PostCard key={"p" + it.id} p={it} img={imgs[it.id]} name={names[it.user_id]?.full_name ?? "Someone"}
            avatarPhoto={names[it.user_id]?.photo ?? null}
            linked={it.event_id ? linkedEvents[it.event_id] : undefined}
            prompt={it.prompt_id ? prompts[it.prompt_id] : undefined}
            liked={likes.mine.has(it.id)} likeCount={likes.counts[it.id] ?? 0}
            onLike={() => onLike(it.id)} />
        ))}
        {!loading && !err && (
          <div ref={sentinelRef} className="py-4 text-center text-xs text-muted-foreground">
            {loadingMore ? "Loading more…" : postsDone ? "" : ""}
          </div>
        )}
      </div>
      <CityPickerModal open={cityModal} onClose={() => setCityModal(false)} onSaved={(c) => { setCity(c); setLocState("idle"); }} />
      <UpgradePrompt open={advOpen} onClose={() => setAdvOpen(false)} title="Advanced filters are Premium" message="Filter by age range, distance and interest tags with Gathr Premium." />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
          <div className="mt-4 h-40 rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  );
}
