import { SocialLinks } from "@/components/SocialLinks";
import { ProfileDetails } from "@/components/ProfileDetails";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedPhotoUrl, ageFromDob, type ProfileRow } from "@/lib/huddl";
import { huddleStatusWith, sendHuddleRequest, respondHuddleRequest, cancelHuddleRequest, listConnections, type HuddleStatus } from "@/lib/huddle-connect";
import { getOrCreateThread } from "@/lib/dm";
import { countByGender, getParticipants, getProfilesLite, listHostedEvents, listJoinedEvents, type EventRow } from "@/lib/events";
import { getEventsLite, getLikes, listUserPosts, signedFeedUrl, toggleLike } from "@/lib/feed";
import { EventCard, type EventCounts } from "@/components/EventCard";
import { PostCard, type PostItem } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { ArrowLeft, MapPin, UserPlus, Check, X, MessageCircle, Clock } from "lucide-react";
import { getMyEntitlements, getUserTiers } from "@/lib/entitlements";
import { PremiumBadge } from "@/components/PremiumBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getVerifiedIds } from "@/lib/verification";
import { useSubscriptionsEnabled } from "@/hooks/useSubscriptionsEnabled";

export const Route = createFileRoute("/_authenticated/_app/u/$userId")({
  component: UserProfile,
});

function UserProfile() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string>("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [avatar, setAvatar] = useState<string>("");
  const [status, setStatus] = useState<HuddleStatus>("none");
  const [reqId, setReqId] = useState<string | undefined>();
  const [connIds, setConnIds] = useState<string[]>([]);
  const [connNames, setConnNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"posts" | "hosting" | "joined">("posts");
  const subsEnabled = useSubscriptionsEnabled();
  const [targetPremium, setTargetPremium] = useState(false);
  const [targetVerified, setTargetVerified] = useState(false);
  const [myPremium, setMyPremium] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMe(user.id);
    const { data: p } = await supabase.from("profiles").select("id, full_name, dob, gender, city, bio, interests, photos, pride_opt_in, onboarding_complete, subscription_tier, premium_expires_at, created_at, instagram_handle, spotify_url, x_handle, height_cm, profession, smoking, drinking").eq("id", userId).maybeSingle();
    setProfile(p as any);
    if ((p as any)?.photos?.[0]) setAvatar(await signedPhotoUrl((p as any).photos[0]));
    const s = await huddleStatusWith(userId);
    setStatus(s.status); setReqId(s.requestId);
    const ids = await listConnections(userId);
    setConnIds(ids);
    if (ids.length) setConnNames(await getProfilesLite(ids));
    const [tiers, ent] = await Promise.all([getUserTiers([userId]), getMyEntitlements()]);
    setTargetVerified((await getVerifiedIds([userId])).has(userId));
    setTargetPremium(tiers[userId] === "premium");
    setMyPremium(ent.hasAccess);
  };
  useEffect(() => { load(); }, [userId]);

  const isMe = me === userId;

  const doHuddle = async () => {
    setBusy(true);
    try {
      await sendHuddleRequest(userId);
      toast.success("Request sent");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const doRespond = async (accept: boolean) => {
    if (!reqId) return;
    setBusy(true);
    try {
      await respondHuddleRequest(reqId, accept);
      toast.success(accept ? "Linked up!" : "Declined");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const doCancel = async () => {
    if (!reqId) return;
    setBusy(true);
    try { await cancelHuddleRequest(reqId); await load(); }
    finally { setBusy(false); }
  };

  const openDm = async () => {
    try {
      const tid = await getOrCreateThread(userId);
      navigate({ to: "/messages/$threadId", params: { threadId: tid } });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>;
  }

  return (
    <div>
      <div className="relative w-full h-[50vh] min-h-[340px] bg-muted overflow-hidden">
        {avatar ? (
          <img src={avatar} className="absolute inset-0 h-full w-full object-cover" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-brand-soft" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <button
          onClick={() => history.back()}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-extrabold tracking-tight drop-shadow-md">
              {profile.full_name || "Member"}
              {profile.dob && <span className="font-semibold text-white/90">, {ageFromDob(profile.dob)}</span>}
            </h1>
            {targetVerified && <VerifiedBadge />}
            {targetPremium && <PremiumBadge />}
          </div>
          {profile.city && (
            <div className="mt-1 inline-flex items-center gap-1 text-[15px] text-white/85">
              <MapPin className="h-4 w-4" />
              {profile.city}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        {!isMe && (
          <div className="flex gap-2">
            {status === "none" && (
              <button disabled={busy} onClick={doHuddle}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand text-white py-2.5 text-sm font-semibold disabled:opacity-50">
                <UserPlus className="h-4 w-4" /> Linkup
              </button>
            )}
            {status === "outgoing" && (
              <button disabled={busy} onClick={doCancel}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-muted py-2.5 text-sm font-semibold">
                <Clock className="h-4 w-4" /> Request sent · Cancel
              </button>
            )}
            {status === "incoming" && (
              <>
                <button disabled={busy} onClick={() => doRespond(true)}
                  className="flex-1 rounded-full bg-gradient-brand text-white py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2">
                  <Check className="h-4 w-4" /> Accept
                </button>
                <button disabled={busy} onClick={() => doRespond(false)}
                  className="rounded-full bg-muted py-2.5 px-4 text-sm font-semibold inline-flex items-center gap-2">
                  <X className="h-4 w-4" /> Decline
                </button>
              </>
            )}
            {status === "connected" && (
              <>
                <button disabled className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand-soft text-foreground py-2.5 text-sm font-semibold">
                  <Check className="h-4 w-4" /> Linked
                </button>
                <button onClick={openDm} className="rounded-full bg-primary text-primary-foreground py-2.5 px-4 text-sm font-semibold inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Message
                </button>
              </>
            )}
            {status === "declined" && (
              <button disabled className="flex-1 rounded-full bg-muted py-2.5 text-sm font-semibold text-muted-foreground">
                Not connected
              </button>
            )}
          </div>
        )}
        {!isMe && myPremium && subsEnabled && status !== "connected" && (
          <button onClick={openDm} className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-semibold">
            <MessageCircle className="h-4 w-4" /> Message directly <PremiumBadge />
          </button>
        )}

        {profile.bio && <p className="mt-4 text-[15px] leading-relaxed">{profile.bio}</p>}

        <SocialLinks
          className="mt-4"
          instagram={(profile as any).instagram_handle}
          spotify={(profile as any).spotify_url}
          x={(profile as any).x_handle}
        />

        <ProfileDetails
          heightCm={(profile as any).height_cm}
          profession={(profile as any).profession}
          smoking={(profile as any).smoking}
          drinking={(profile as any).drinking}
        />





        {profile.interests?.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-medium text-muted-foreground mb-2">INTERESTS</div>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((i) => (
                <span key={i} className="rounded-full bg-muted px-3 py-1 text-[13px] font-medium">{i}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="text-xs font-medium text-muted-foreground mb-2">LINKED WITH · {connIds.length}</div>
          {connIds.length === 0 ? (
            <div className="text-sm text-muted-foreground">No connections yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connIds.map((uid) => (
                <Link key={uid} to="/u/$userId" params={{ userId: uid }}
                  className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                  <Avatar photo={connNames[uid]?.photo} name={connNames[uid]?.full_name} size={24} />
                  <span className="text-[13px] font-medium truncate max-w-[120px]">{connNames[uid]?.full_name ?? "Member"}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 border-b border-border">
          <div className="flex gap-6 text-sm">
            {((isMe || targetPremium || !subsEnabled)
              ? ([["posts","Posts"],["hosting","Host history"],["joined","Joined"]] as const).filter(([k]) => isMe || k !== "joined")
              : ([["posts","Posts"]] as const)
            ).map(([k,label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`pb-3 -mb-px border-b-2 font-medium transition ${tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="py-5">
          {tab === "posts" && <UserPosts userId={userId} name={profile.full_name} />}
          {tab === "hosting" && (isMe || targetPremium || !subsEnabled) && <UserEvents kind="hosting" userId={userId} />}
          {isMe && tab === "joined" && <UserEvents kind="joined" userId={userId} />}
        </div>
      </div>
    </div>
  );
}

function UserPosts({ userId, name }: { userId: string; name: string | null }) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<{ counts: Record<string, number>; mine: Set<string> }>({ counts: {}, mine: new Set() });
  const [linked, setLinked] = useState<Record<string, { id: string; title: string; event_type: string | null }>>({});
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);
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
      const [l, prof, ev] = await Promise.all([
        getLikes(items.map((p) => p.id)),
        getProfilesLite([userId]),
        getEventsLite(items.map((p) => p.event_id ?? "")),
      ]);
      setLikes(l); setLinked(ev);
      setAvatarPhoto(prof[userId]?.photo ?? null);
      const im: Record<string, string> = {};
      for (const p of items) if (p.photo_url) im[p.id] = await signedFeedUrl(p.photo_url);
      setImgs(im);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [userId]);

  if (loading) return <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>;
  if (posts.length === 0) return <div className="text-sm text-muted-foreground text-center py-8">No posts yet.</div>;

  const openPost = openId ? posts.find((p) => p.id === openId) : null;
  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((p) => (
          <button key={p.id} onClick={() => setOpenId(p.id)}
            className="relative aspect-square overflow-hidden bg-muted focus:outline-none">
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpenId(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-background" onClick={(e) => e.stopPropagation()}>
            <PostCard
              p={openPost}
              img={imgs[openPost.id]}
              name={name ?? "Member"}
              avatarPhoto={avatarPhoto}
              linked={openPost.event_id ? linked[openPost.event_id] : undefined}
              liked={likes.mine.has(openPost.id)}
              likeCount={likes.counts[openPost.id] ?? 0}
              onLike={async () => { await toggleLike(openPost.id); await refresh(); }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function UserEvents({ kind, userId }: { kind: "hosting" | "joined"; userId: string }) {
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
  if (events.length === 0) return <div className="text-sm text-muted-foreground text-center py-8">{kind === "hosting" ? "No hosted events yet." : "No joined events yet."}</div>;
  return (
    <div className="space-y-3">
      {events.map((e) => (
        <EventCard key={e.id} e={e} c={counts[e.id]} host={hosts[e.host_id]} />
      ))}
    </div>
  );
}
