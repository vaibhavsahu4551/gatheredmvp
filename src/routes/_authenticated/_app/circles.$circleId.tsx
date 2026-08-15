import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Users, Link2, MessageCircle, CalendarPlus, LogOut, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  circleInviteLink, deleteCircle, getCircle, listCircleMemberIds, removeCircleMember,
  signedCirclePhotoUrl, type CircleWithMeta,
} from "@/lib/circles";
import { getProfilesLite } from "@/lib/events";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/_app/circles/$circleId")({
  component: CircleDetail,
});

function CircleDetail() {
  const { circleId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState("");
  const [circle, setCircle] = useState<CircleWithMeta | null>(null);
  const [photo, setPhoto] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    setMe(data.user?.id ?? "");
    const c = await getCircle(circleId);
    setCircle(c);
    if (c?.photo_path) setPhoto(await signedCirclePhotoUrl(c.photo_path));
    const ids = await listCircleMemberIds(circleId);
    setMemberIds(ids);
    if (ids.length) setNames((await getProfilesLite(ids)) as any);
    setLoading(false);
  };
  useEffect(() => { refresh().catch((e) => { toast.error(e?.message ?? "Could not load circle"); setLoading(false); }); }, [circleId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  if (!circle) return <div className="px-5 pt-10 text-sm text-muted-foreground">This circle isn't available.</div>;

  const isOwner = circle.created_by === me;

  const copyInvite = async () => {
    const link = circleInviteLink(circle.invite_code);
    try {
      if (navigator.share) await navigator.share({ title: circle.name, text: `Join my Gathr circle "${circle.name}"`, url: link });
      else { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); }
    } catch { /* user dismissed the share sheet */ }
  };

  const leave = async () => {
    if (!confirm("Leave this circle?")) return;
    try { await removeCircleMember(circle.id, me); toast.success("Left the circle"); navigate({ to: "/circles" }); }
    catch (e: any) { toast.error(e?.message ?? "Could not leave"); }
  };

  const remove = async () => {
    if (!confirm("Delete this circle for everyone?")) return;
    try { await deleteCircle(circle.id); toast.success("Circle deleted"); navigate({ to: "/circles" }); }
    catch (e: any) { toast.error(e?.message ?? "Could not delete"); }
  };

  return (
    <div className="pb-28">
      <header className="px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/circles" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold truncate">{circle.name}</div>
      </header>

      <div className="px-5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-3xl overflow-hidden bg-gradient-brand-soft flex items-center justify-center shrink-0">
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <Users className="h-7 w-7 text-[color:var(--brand)]" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{circle.name}</h1>
            <div className="text-[13px] text-muted-foreground">{memberIds.length} member{memberIds.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        {circle.description && <p className="mt-3 text-[15px] leading-relaxed">{circle.description}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
          {circle.group_id ? (
            <Link
              to="/chat/$groupId"
              params={{ groupId: circle.group_id }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand text-white py-2.5 text-sm font-semibold"
            >
              <MessageCircle className="h-4 w-4" /> Circle chat
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center rounded-full border border-border py-2.5 text-sm text-muted-foreground">Chat unavailable</div>
          )}
          <Link
            to="/create"
            search={{ circle: circle.id } as any}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium"
          >
            <CalendarPlus className="h-4 w-4" /> Plan an event
          </Link>
        </div>

        <button
          onClick={copyInvite}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium"
        >
          <Link2 className="h-4 w-4" /> Share invite link
        </button>
        <div className="mt-2 rounded-2xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground break-all">
          {circleInviteLink(circle.invite_code)}
        </div>

        <div className="mt-6">
          <div className="text-xs font-medium text-muted-foreground mb-2">MEMBERS</div>
          <div className="space-y-2">
            {memberIds.map((uid) => (
              <div key={uid} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
                <Avatar photo={names[uid]?.photo} name={names[uid]?.full_name} size={38} />
                <Link to="/u/$userId" params={{ userId: uid }} className="min-w-0 flex-1 text-sm font-semibold truncate">
                  {uid === me ? "You" : (names[uid]?.full_name ?? "Member")}
                </Link>
                {uid === circle.created_by && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">Owner</span>}
                {isOwner && uid !== me && (
                  <button
                    onClick={async () => {
                      try { await removeCircleMember(circle.id, uid); toast.success("Removed"); await refresh(); }
                      catch (e: any) { toast.error(e?.message ?? "Could not remove"); }
                    }}
                    className="text-[11px] text-muted-foreground underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {isOwner ? (
            <button onClick={remove} className="inline-flex items-center gap-2 text-sm text-destructive">
              <Trash2 className="h-4 w-4" /> Delete circle
            </button>
          ) : (
            <button onClick={leave} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <LogOut className="h-4 w-4" /> Leave circle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
