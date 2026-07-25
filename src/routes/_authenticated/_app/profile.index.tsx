import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, signedPhotoUrl, ageFromDob } from "@/lib/huddl";
import { LogOut, ShieldCheck, MapPin, Plus, CalendarPlus, Pencil } from "lucide-react";
import {
  countByGender,
  getParticipants,
  getProfilesLite,
  listHostedEvents,
  listJoinedEvents,
  type EventRow,
} from "@/lib/events";
import {
  getEventsLite,
  getLikes,
  listUserPosts,
  signedFeedUrl,
  toggleLike,
} from "@/lib/feed";

import { EventCard, type EventCounts } from "@/components/EventCard";
import { PostCard, type PostItem } from "@/components/PostCard";

export const Route = createFileRoute("/_authenticated/_app/profile/")({
  component: Profile,
});

type Tab = "posts" | "hosting" | "joined";

function Profile() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Awaited<ReturnType<typeof loadMe>>>(null);
  const [avatar, setAvatar] = useState<string>("");
  const [tab, setTab] = useState<Tab>("posts");

  useEffect(() => {
    loadMe().then(async (data) => {
      setMe(data);
      const photos = data?.profile?.photos ?? [];
      if (photos[0]) setAvatar(await signedPhotoUrl(photos[0]));
    });
  }, []);

  if (!me?.profile)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  const p = me.profile;

  return (
    <div>
      <div className="px-5 pt-8">
        <div className="flex items-start gap-4">
          <div className="h-24 w-24 rounded-full ring-4 ring-background bg-muted overflow-hidden shrink-0 shadow-elevated">
            {avatar && <img src={avatar} className="h-full w-full object-cover" alt="" />}
          </div>
          <div className="pt-2 min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {p.full_name || "Add your name"}
              {p.dob && <span className="text-muted-foreground font-normal">, {ageFromDob(p.dob)}</span>}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {p.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {p.city}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate({ to: "/profile/edit" })}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background py-2.5 text-sm font-medium hover:bg-muted transition"
        >
          <Pencil className="h-4 w-4" /> Edit profile
        </button>

        {p.bio && <p className="mt-4 text-[15px] leading-relaxed">{p.bio}</p>}

        {p.interests?.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-medium text-muted-foreground mb-2">INTERESTS</div>
            <div className="flex flex-wrap gap-2">
              {p.interests.map((i) => (
                <span key={i} className="rounded-full bg-muted px-3 py-1 text-[13px] font-medium">{i}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 border-b border-border">
          <div className="flex gap-6 text-sm">
            {([
              ["posts", "Posts"],
              ["hosting", "My Events"],
              ["joined", "Joined Events"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`pb-3 -mb-px border-b-2 font-medium transition ${
                  tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="py-5">
          {tab === "posts" && <PostsTab userId={me.user.id} onCreate={() => navigate({ to: "/create" })} />}
          {tab === "hosting" && (
            <EventsTab kind="hosting" userId={me.user.id} onCreate={() => navigate({ to: "/create" })} />
          )}
          {tab === "joined" && (
            <EventsTab kind="joined" userId={me.user.id} onCreate={() => navigate({ to: "/home" })} />
          )}
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
          className="mt-6 mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function PostsTab({ userId, onCreate }: { userId: string; onCreate: () => void }) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<{ counts: Record<string, number>; mine: Set<string> }>({ counts: {}, mine: new Set() });
  const [names, setNames] = useState<Record<string, { full_name: string | null }>>({});
  const [linked, setLinked] = useState<Record<string, { id: string; title: string; event_type: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const raw = await listUserPosts(userId);
      const items: PostItem[] = (raw as any[]).map((p) => ({
        kind: "post", id: p.id, created_at: p.created_at, user_id: p.user_id,
        caption: p.caption, photo_url: p.photo_url, event_id: p.event_id ?? null,
      }));
      setPosts(items);
      const [l, n, ev] = await Promise.all([
        getLikes(items.map((p) => p.id)),
        getProfilesLite(items.map((p) => p.user_id)),
        getEventsLite(items.map((p) => p.event_id ?? "")),
      ]);
      setLikes(l); setNames(n); setLinked(ev);
      const im: Record<string, string> = {};
      for (const p of items) if (p.photo_url) im[p.id] = await signedFeedUrl(p.photo_url);
      setImgs(im);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [userId]);

  if (loading) return <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>;
  if (posts.length === 0)
    return (
      <EmptyState
        icon={<Plus className="h-5 w-5" />}
        title="No posts yet"
        cta="Create your first post"
        onClick={onCreate}
      />
    );

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard
          key={p.id}
          p={p}
          img={imgs[p.id]}
          name={names[p.user_id]?.full_name ?? "You"}
          linked={p.event_id ? linked[p.event_id] : undefined}
          liked={likes.mine.has(p.id)}
          likeCount={likes.counts[p.id] ?? 0}
          onLike={async () => { await toggleLike(p.id); await refresh(); }}
        />
      ))}
    </div>
  );
}

function EventsTab({ kind, userId, onCreate }: { kind: "hosting" | "joined"; userId: string; onCreate: () => void }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, EventCounts>>({});
  const [hosts, setHosts] = useState<Record<string, { full_name: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const ev = kind === "hosting" ? await listHostedEvents(userId) : await listJoinedEvents(userId);
      setEvents(ev);
      const cts: Record<string, EventCounts> = {};
      for (const e of ev) cts[e.id] = countByGender(await getParticipants(e.id));
      setCounts(cts);
      setHosts(await getProfilesLite(ev.map((e) => e.host_id)));
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [kind, userId]);

  if (loading) return <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>;
  if (events.length === 0)
    return (
      <EmptyState
        icon={<CalendarPlus className="h-5 w-5" />}
        title={kind === "hosting" ? "You haven't hosted any events yet" : "You haven't joined any events yet"}
        cta={kind === "hosting" ? "Create your first event" : "Discover events"}
        onClick={onCreate}
      />
    );

  return (
    <div className="space-y-3">
      {events.map((e) => (
        <EventCard key={e.id} e={e} c={counts[e.id]} host={hosts[e.host_id]} />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, cta, onClick }: { icon: React.ReactNode; title: string; cta: string; onClick: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-10 px-6 text-center">
      <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">{icon}</div>
      <div className="mt-3 text-sm text-muted-foreground">{title}</div>
      <button
        onClick={onClick}
        className="mt-4 rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium"
      >
        {cta}
      </button>
    </div>
  );
}
