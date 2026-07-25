import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listNotifications, markAllRead, type Notification } from "@/lib/notifications";
import { getProfilesLite } from "@/lib/events";
import { ArrowLeft, Bell, UserPlus, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/notifications")({
  component: Notifications,
});

function Notifications() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Notification[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await listNotifications();
      setRows(r);
      const ids = Array.from(new Set(r.map((x) => x.actor_id).filter(Boolean) as string[]));
      if (ids.length) setNames(await getProfilesLite(ids));
      setLoading(false);
      await markAllRead();
    })();
  }, []);

  return (
    <div>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/home" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      </header>
      <div className="px-5 space-y-2">
        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">You're all caught up.</p>
          </div>
        )}
        {rows.map((n) => {
          const name = n.actor_id ? names[n.actor_id]?.full_name ?? "Someone" : "Someone";
          const isReq = n.kind === "huddle_request";
          return (
            <Link
              key={n.id}
              to={isReq ? "/requests" : "/u/$userId"}
              params={isReq ? undefined as any : { userId: n.actor_id! }}
              className="flex items-center gap-3 rounded-2xl border border-border p-3 bg-card"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-brand text-white flex items-center justify-center">
                {isReq ? <UserPlus className="h-5 w-5" /> : <HeartHandshake className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-semibold">{name}</span>{" "}
                  {isReq ? "sent you a Huddle Up request" : "accepted your Huddle Up request"}
                </div>
                <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
