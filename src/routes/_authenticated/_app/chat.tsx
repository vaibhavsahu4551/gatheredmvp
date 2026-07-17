import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyGroups } from "@/lib/chat";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/chat")({
  component: Chat,
});

function Chat() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listMyGroups().then((g) => { setGroups(g); setLoading(false); }); }, []);

  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Group chats unlock when your HUDDL confirms.</p>
      </header>

      <div className="px-5 space-y-2">
        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && groups.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">No conversations yet.</p>
          </div>
        )}
        {groups.map((g) => (
          <Link key={g.id} to="/chat/$groupId" params={{ groupId: g.id }}
            className="block rounded-2xl border border-border p-4 bg-card">
            <div className="text-[15px] font-semibold">{g.events?.title ?? "Group"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{g.events?.starts_at ? new Date(g.events.starts_at).toLocaleString() : ""}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
