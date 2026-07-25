import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyThreads } from "@/lib/dm";
import { getProfilesLite } from "@/lib/events";
import { Avatar } from "@/components/Avatar";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/messages/")({
  component: Messages,
});

type Thread = { id: string; other_id: string; updated_at: string };

function Messages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = (await listMyThreads()) as Thread[];
      setThreads(t);
      if (t.length) setNames((await getProfilesLite(t.map((x) => x.other_id))) as any);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">Direct chats with your Huddle Up connections.</p>
      </header>
      <div className="px-5 space-y-2">
        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && threads.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No direct chats yet. Huddle Up with someone to start one.</p>
          </div>
        )}
        {threads.map((t) => {
          const n = names[t.other_id];
          return (
            <Link key={t.id} to="/messages/$threadId" params={{ threadId: t.id }}
              className="flex items-center gap-3 rounded-2xl border border-border p-3 bg-card">
              <Avatar photo={n?.photo} name={n?.full_name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{n?.full_name ?? "Member"}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
