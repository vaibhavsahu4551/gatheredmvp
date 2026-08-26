import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listNotifications, markAllRead, NOTIFICATIONS_PAGE, type Notification } from "@/lib/notifications";
import { ListSkeleton } from "@/components/Skeletons";
import { getProfilesLite } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Bell } from "lucide-react";
import { LinkupConfirmModal, type LinkupPeer } from "@/components/LinkupConfirmModal";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/notifications")({
  component: Notifications,
});

function label(kind: string) {
  switch (kind) {
    case "huddle_request": return "sent you a Linkup request";
    case "huddle_accepted": return "accepted your Linkup request";
    case "post_like": return "liked your post";
    case "post_comment": return "commented on your post";
    case "join_request": return "requested to join your event";
    case "join_approved": return "approved your request to join";
    case "join_declined": return "couldn't fit you in this time";
    case "event_closed": return "closed a Gathr you'd joined";
    case "event_no_attendees": return "No one has joined yet — reschedule or close it";
    case "verification_approved": return "Your account is verified — the Verified badge is now on your profile";
    case "verification_rejected": return "Verification wasn't approved — tap to retake your selfie";
    default: return "sent you a notification";
  }
}

async function loadPeer(id: string): Promise<LinkupPeer> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, photos, interests")
    .eq("id", id)
    .maybeSingle();
  const photos = ((data as any)?.photos as string[] | null) ?? [];
  return {
    id,
    name: (data as any)?.full_name ?? null,
    photo: photos[0] ?? null,
    interests: ((data as any)?.interests as string[] | null) ?? [],
  };
}

function Notifications() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [celebrate, setCelebrate] = useState<{ me: LinkupPeer; other: LinkupPeer } | null>(null);

  const hydrate = async (r: Notification[]) => {
    const ids = Array.from(new Set(r.map((x) => x.actor_id).filter(Boolean) as string[]));
    if (ids.length) {
      const p = (await getProfilesLite(ids)) as any;
      setProfiles((prev) => ({ ...prev, ...p }));
    }
  };

  useEffect(() => {
    (async () => {
      const r = await listNotifications({ limit: NOTIFICATIONS_PAGE, offset: 0 });
      setRows(r);
      setDone(r.length < NOTIFICATIONS_PAGE);
      await hydrate(r);
      setLoading(false);
      await markAllRead();
    })();
  }, []);

  const loadMore = async () => {
    if (loadingMore || done) return;
    setLoadingMore(true);
    try {
      const r = await listNotifications({ limit: NOTIFICATIONS_PAGE, offset: rows.length });
      setRows((prev) => [...prev, ...r]);
      if (r.length < NOTIFICATIONS_PAGE) setDone(true);
      await hydrate(r);
    } finally {
      setLoadingMore(false);
    }
  };

  const openAccepted = async (actorId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [me, other] = await Promise.all([loadPeer(user.id), loadPeer(actorId)]);
      setCelebrate({ me, other });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/home" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      </header>
      <div className="px-5 space-y-2">
        {loading && <ListSkeleton rows={6} />}
        {!loading && rows.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">You're all caught up.</p>
          </div>
        )}
        {rows.map((n) => {
          const p = n.actor_id ? profiles[n.actor_id] : null;
          const name = p?.full_name ?? "Someone";
          const isReq = n.kind === "huddle_request";
          const isAccepted = n.kind === "huddle_accepted";
          const isEventKind = n.kind === "join_request" || n.kind === "join_approved" || n.kind === "join_declined" || n.kind === "event_closed" || n.kind === "event_no_attendees";
          const isHostNudge = n.kind === "event_no_attendees";
          const reason = n.kind === "event_closed" ? (n.data?.reason as string | null) : null;
          const eventTitle = (n.data?.title as string | null) ?? null;

          const inner = (
            <>
              <Avatar photo={p?.photo ?? null} name={name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {isHostNudge ? (
                    <><span className="font-semibold">{eventTitle ?? "Your Gathr"}</span> — {label(n.kind)}</>
                  ) : (
                    <><span className="font-semibold">{name}</span> {label(n.kind)}{eventTitle && n.kind === "event_closed" ? `: ${eventTitle}` : ""}</>
                  )}
                </div>
                {reason && <div className="text-[12px] text-muted-foreground italic">"{reason}"</div>}
                {isHostNudge && n.target_id && (
                  <div className="mt-1.5 flex gap-2">
                    <Link
                      to="/events/$eventId/edit"
                      params={{ eventId: n.target_id }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-full border border-border px-3 py-1 text-[11px] font-medium"
                    >
                      Reschedule
                    </Link>
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: n.target_id }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-full border border-border px-3 py-1 text-[11px] font-medium"
                    >
                      Close event
                    </Link>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </>
          );

          const className = "flex items-center gap-3 rounded-2xl border border-border p-3 bg-card w-full text-left";

          if (isAccepted && n.actor_id) {
            const actorId = n.actor_id;
            return (
              <button key={n.id} onClick={() => openAccepted(actorId)} className={className}>
                {inner}
              </button>
            );
          }

          const toProps: any = isReq
            ? { to: "/requests" }
            : isEventKind && n.target_id
              ? { to: "/events/$eventId", params: { eventId: n.target_id } }
              : n.actor_id
                ? { to: "/u/$userId", params: { userId: n.actor_id } }
                : { to: "/home" };
          return (
            <Link key={n.id} {...toProps} className={className}>
              {inner}
            </Link>
          );
        })}
        {!loading && rows.length > 0 && !done && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full rounded-full border border-border py-2 text-sm font-medium disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>

      {celebrate && (
        <LinkupConfirmModal
          me={celebrate.me}
          other={celebrate.other}
          open
          onClose={() => setCelebrate(null)}
        />
      )}
    </div>
  );
}
