import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe, signedPhotoUrl, ageFromDob } from "@/lib/huddl";
import { LogOut, MapPin, Plus, CalendarPlus, Pencil, UserPlus, Users, Sparkles, X, Settings as SettingsIcon } from "lucide-react";
import { listConnections } from "@/lib/huddle-connect";
import { listIncomingRequests } from "@/lib/huddle-connect";
import {
  countByGender,
  getParticipants,
  getProfilesLite,
  listHostedEvents,
  listJoinedEvents,
  type EventRow,
} from "@/lib/events";
import {
  deletePost,
  getEventsLite,
  getLikes,
  listUserPosts,
  signedFeedUrl,
  toggleLike,
} from "@/lib/feed";
import { toast } from "sonner";

import { EventCard, type EventCounts } from "@/components/EventCard";
import { SocialLinks } from "@/components/SocialLinks";
import { ProfileDetails } from "@/components/ProfileDetails";

import { PostCard, type PostItem } from "@/components/PostCard";
import { useSubscriptionsEnabled } from "@/hooks/useSubscriptionsEnabled";


export const Route = createFileRoute("/_authenticated/_app/profile/")({
  component: Profile,
});

type Tab = "posts" | "hosting" | "joined";

function Profile() {
  const navigate = useNavigate();
  const subsEnabled = useSubscriptionsEnabled();
  const [me, setMe] = useState<Awaited<ReturnType<typeof loadMe>>>(null);
  const [avatar, setAvatar] = useState<string>("");
  const [tab, setTab] = useState<Tab>("posts");
  const [connIds, setConnIds] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showConnections, setShowConnections] = useState(false);

  useEffect(() => {
    loadMe().then(async (data) => {
      setMe(data);
      const photos = data?.profile?.photos ?? [];
      if (photos[0]) setAvatar(await signedPhotoUrl(photos[0]));
      if (data?.user) {
        const ids = await listConnections(data.user.id);
        setConnIds(ids);
        const inc = await listIncomingRequests();
        setPendingCount(inc.length);
      }
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
      <div className="relative w-full h-[50vh] min-h-[340px] bg-muted overflow-hidden">
        {avatar ? (
          <img src={avatar} className="absolute inset-0 h-full w-full object-cover" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-brand-soft" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <Link
          to="/settings"
          aria-label="Settings"
          className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/35 backdrop-blur flex items-center justify-center text-white hover:bg-black/50 transition"
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h1 className="text-3xl font-extrabold tracking-tight drop-shadow-md">
            {p.full_name || "Add your name"}
            {p.dob && <span className="font-semibold text-white/90">, {ageFromDob(p.dob)}</span>}
          </h1>
          {p.city && (
            <div className="mt-1 inline-flex items-center gap-1 text-[15px] text-white/85">
              <MapPin className="h-4 w-4" />
              {p.city}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        {p.bio && <p className="mb-4 text-[15px] leading-relaxed">{p.bio}</p>}

        <SocialLinks instagram={p.instagram_handle} spotify={p.spotify_url} x={p.x_handle} />

        <ProfileDetails heightCm={p.height_cm} profession={p.profession} smoking={p.smoking} drinking={p.drinking} />




        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigate({ to: "/profile/edit" })}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background py-2.5 text-sm font-medium hover:bg-muted transition"
          >
            <Pencil className="h-4 w-4" /> Edit profile
          </button>
          <Link
            to="/requests"
            className="relative inline-flex items-center gap-2 rounded-full bg-gradient-brand text-white px-4 py-2.5 text-sm font-semibold"
          >
            <UserPlus className="h-4 w-4" /> Requests
            {pendingCount > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full bg-white text-primary text-[11px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>

        <button
          onClick={() => setShowConnections(true)}
          className="mt-4 flex items-center gap-2 text-sm hover:opacity-80 transition"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{connIds.length}</span>
          <span className="text-muted-foreground">Linked with</span>
        </button>

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

        {subsEnabled && <Link
          to="/premium"
          className="mt-5 flex items-center gap-3 rounded-2xl border border-border p-3 bg-gradient-to-r from-rose-50 to-indigo-50 hover:opacity-90 transition"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-brand flex items-center justify-center shadow-glow shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Gathr Premium</div>
            <div className="text-[12px] text-muted-foreground truncate">
              Unlock priority visibility, unlimited hosting, and more.
            </div>
          </div>
          <span className="text-xs font-semibold text-primary shrink-0">₹199/mo</span>
        </Link>}

        {showConnections && (
          <ConnectionsModal ids={connIds} onClose={() => setShowConnections(false)} />
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
  const [openId, setOpenId] = useState<string | null>(null);


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

  const openPost = openId ? posts.find((p) => p.id === openId) : null;


  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((p) => (
          <button
            key={p.id}
            onClick={() => setOpenId(p.id)}
            className="relative aspect-square overflow-hidden bg-muted focus:outline-none"
          >
            {p.photo_url && imgs[p.id] ? (
              <img src={imgs[p.id]} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-3 bg-background ring-1 ring-inset ring-border">
                <div className="text-[12px] leading-snug text-foreground line-clamp-6 text-left whitespace-pre-wrap font-medium">
                  {p.caption ?? ""}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {openPost && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            <PostCard
              p={openPost}
              img={imgs[openPost.id]}
              name={names[openPost.user_id]?.full_name ?? "You"}
              avatarPhoto={(names[openPost.user_id] as any)?.photo ?? null}
              linked={openPost.event_id ? linked[openPost.event_id] : undefined}
              liked={likes.mine.has(openPost.id)}
              likeCount={likes.counts[openPost.id] ?? 0}
              onLike={async () => { await toggleLike(openPost.id); await refresh(); }}
              onDelete={async () => {
                try {
                  await deletePost(openPost.id);
                  toast.success("Post deleted");
                  setOpenId(null);
                  await refresh();
                } catch (e: any) { toast.error(e?.message ?? "Could not delete post"); }
              }}
            />
          </div>
        </div>
      )}
    </>
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
      const raw = kind === "hosting" ? await listHostedEvents(userId) : await listJoinedEvents(userId);
      const ev = raw.filter((e) => !e.is_pride);
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

function ConnectionsModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!ids.length) return;
    getProfilesLite(ids).then(async (fetched) => {
      setNames(fetched);
      const map: Record<string, string> = {};
      await Promise.all(
        Object.entries(fetched).map(async ([uid, profile]) => {
          const path = profile?.photo;
          if (path) {
            const url = await signedPhotoUrl(path);
            if (url) map[uid] = url;
          }
        })
      );
      setPhotos(map);
    });
  }, [ids]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-elevated max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold">Linkups</div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        {ids.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-gradient-brand-soft flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-[color:var(--brand)]" />
            </div>
            <div className="text-sm font-semibold">No Linkups yet</div>
            <div className="text-sm text-muted-foreground mt-1">Start connecting at events!</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ids.map((uid) => {
              const name = names[uid]?.full_name ?? "Member";
              const initials = name.trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
              return (
                <Link
                  key={uid}
                  to="/u/$userId"
                  params={{ userId: uid }}
                  onClick={onClose}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-muted shadow-sm"
                >
                  {photos[uid] ? (
                    <img src={photos[uid]} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-brand-soft flex items-center justify-center">
                      <span className="text-2xl font-bold text-[color:var(--brand)]">{initials || "·"}</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-3">
                    <div className="text-sm font-semibold text-white truncate drop-shadow">{name}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
