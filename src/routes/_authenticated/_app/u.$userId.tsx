import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedPhotoUrl, ageFromDob, type ProfileRow } from "@/lib/huddl";
import { huddleStatusWith, sendHuddleRequest, respondHuddleRequest, cancelHuddleRequest, listConnections, type HuddleStatus } from "@/lib/huddle-connect";
import { getOrCreateThread } from "@/lib/dm";
import { getProfilesLite } from "@/lib/events";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";
import { ArrowLeft, MapPin, UserPlus, Check, X, MessageCircle, Clock } from "lucide-react";

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

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMe(user.id);
    const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(p as any);
    if ((p as any)?.photos?.[0]) setAvatar(await signedPhotoUrl((p as any).photos[0]));
    const s = await huddleStatusWith(userId);
    setStatus(s.status); setReqId(s.requestId);
    const ids = await listConnections(userId);
    setConnIds(ids);
    if (ids.length) setConnNames(await getProfilesLite(ids));
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
      <header className="px-5 pt-8 pb-2 flex items-center gap-3">
        <button onClick={() => history.back()} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
      </header>
      <div className="px-5">
        <div className="flex items-start gap-4">
          <div className="h-24 w-24 rounded-full ring-4 ring-background bg-muted overflow-hidden shrink-0 shadow-elevated">
            {avatar && <img src={avatar} className="h-full w-full object-cover" alt="" />}
          </div>
          <div className="pt-2 min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {profile.full_name || "Member"}
              {profile.dob && <span className="text-muted-foreground font-normal">, {ageFromDob(profile.dob)}</span>}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {profile.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.city}</span>}
            </div>
          </div>
        </div>

        {!isMe && (
          <div className="mt-4 flex gap-2">
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
                  <Check className="h-4 w-4" /> Huddled
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

        {profile.bio && <p className="mt-4 text-[15px] leading-relaxed">{profile.bio}</p>}

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
      </div>
    </div>
  );
}
