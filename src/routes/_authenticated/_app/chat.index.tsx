import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyThreads } from "@/lib/dm";
import { listMyGroups } from "@/lib/chat";
import { getProfilesLite } from "@/lib/events";
import { Avatar } from "@/components/Avatar";
import { MessageCircle, Users } from "lucide-react";
import { useDmUnread } from "@/hooks/useDmUnread";

export const Route = createFileRoute("/_authenticated/_app/chat/")({
  component: Chat,
});

type Thread = { id: string; other_id: string; updated_at: string };

function Chat() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { map: unread } = useDmUnread();

  useEffect(() => {
    (async () => {
      const [t, g] = await Promise.all([listMyThreads() as Promise<Thread[]>, listMyGroups()]);
      setThreads(t);
      setGroups(g);
      if (t.length) setNames((await getProfilesLite(t.map((x) => x.other_id))) as any);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Direct chats with your Linkup connections.</p>
      </header>

      <div className="px-5 space-y-2">
        {groups.length > 0 ? (
          <div className="rounded-2xl border border-border bg-gradient-brand-soft p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4" />
              <div className="text-sm font-semibold">Group chats</div>
            </div>
            <div className="space-y-1.5">
              {groups.map((g) => (
                <Link
                  key={g.id}
                  to="/chat/$groupId"
                  params={{ groupId: g.id }}
                  className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{g.events?.title ?? "Group"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {g.events?.starts_at ? new Date(g.events.starts_at).toLocaleString() : ""}
                    </div>
                  </div>
                  <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
            Group chats unlock when your Gathr confirms.
          </div>
        )}

        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && threads.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No conversations yet. Linkup with someone to start one.</p>
          </div>
        )}
        {threads.map((t) => {
          const n = names[t.other_id];
          const u = unread[t.id];
          const count = u?.unread ?? 0;
          const preview = u?.last_body || "Say hi 👋";
          return (
            <Link
              key={t.id}
              to="/messages/$threadId"
              params={{ threadId: t.id }}
              className="flex items-center gap-3 rounded-2xl border border-border p-3 bg-card"
            >
              <Avatar photo={n?.photo} name={n?.full_name} size={44} />
              <div className="min-w-0 flex-1">
                <div className={`text-sm truncate ${count > 0 ? "font-bold" : "font-semibold"}`}>{n?.full_name ?? "Member"}</div>
                <div className={`text-[12px] truncate ${count > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{preview}</div>
              </div>
              {count > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
