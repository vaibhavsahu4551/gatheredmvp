import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listNotifications, markAllRead, type Notification } from "@/lib/notifications";
import { ArrowLeft, Bell, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/pride/notifications")({
  component: PrideNotifications,
});

function label(kind: string) {
  switch (kind) {
    case "join_request": return "requested to join your Pride event";
    case "join_approved": return "approved your request to join";
    case "join_declined": return "couldn't fit you in this time";
    default: return "sent you an update";
  }
}

function PrideNotifications() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await listNotifications({ pride: true });
      setRows(r);
      setLoading(false);
      await markAllRead({ pride: true });
    })();
  }, []);

  return (
    <div>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/pride" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500 flex items-center justify-center shadow-glow">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Pride notifications</h1>
      </header>
      <div className="px-5 space-y-2 pb-8">
        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Nothing new in Pride.</p>
          </div>
        )}
        {rows.map((n) => {
          const isEventKind = n.kind === "join_request" || n.kind === "join_approved" || n.kind === "join_declined";
          const toProps: any = isEventKind && n.target_id
            ? { to: "/events/$eventId", params: { eventId: n.target_id } }
            : { to: "/pride" };
          return (
            <Link
              key={n.id}
              {...toProps}
              className="flex items-center gap-3 rounded-2xl border border-border p-3 bg-card"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-semibold">A member</span> {label(n.kind)}
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
