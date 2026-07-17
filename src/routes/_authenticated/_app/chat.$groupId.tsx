import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMessages, sendMessage } from "@/lib/chat";
import { getProfilesLite } from "@/lib/events";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/chat/$groupId")({
  component: ChatRoom,
});

function ChatRoom() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null }>>({});
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? ""));
    (async () => {
      const msgs = await listMessages(groupId);
      setMessages(msgs);
      const n = await getProfilesLite(msgs.map((m) => m.user_id));
      setNames(n);
    })();
    const channel = supabase.channel(`chat-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const m = payload.new as any;
          setMessages((prev) => [...prev, m]);
          if (!names[m.user_id]) {
            const n = await getProfilesLite([m.user_id]);
            setNames((s) => ({ ...s, ...n }));
          }
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const body = text.trim(); setText("");
    try { await sendMessage(groupId, body); } catch (e: any) { setText(body); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 pt-6 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate({ to: "/chat" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold">Group chat</div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((m) => {
          const mine = m.user_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <div className="text-[10px] font-medium opacity-70 mb-0.5">{names[m.user_id]?.full_name ?? "Someone"}</div>}
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3 flex gap-2 pb-6">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…" className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none" />
        <button onClick={send} className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
