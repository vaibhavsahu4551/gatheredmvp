import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMessages, sendMessage } from "@/lib/chat";
import { getProfilesLite } from "@/lib/events";
import { getPrideIdentities } from "@/lib/pride";
import { ArrowLeft, Send, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/chat/$groupId")({
  component: ChatRoom,
});

function ChatRoom() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState("");
  const [isPride, setIsPride] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null }>>({});
  const [prideNames, setPrideNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? ""));
    (async () => {
      // Determine if this chat belongs to a Pride event.
      const { data: g } = await supabase.from("chat_groups").select("event_id").eq("id", groupId).maybeSingle();
      let pride = false;
      if (g?.event_id) {
        const { data: e } = await supabase.from("events").select("is_pride").eq("id", g.event_id).maybeSingle();
        pride = !!(e as any)?.is_pride;
      }
      setIsPride(pride);

      const msgs = await listMessages(groupId);
      setMessages(msgs);
      if (pride) {
        const pids = Array.from(new Set(msgs.map((m: any) => m.pride_actor_id).filter(Boolean) as string[]));
        if (pids.length) {
          const idents = await getPrideIdentities(pids);
          setPrideNames(Object.fromEntries(Object.values(idents).map((i) => [i.pride_id, i.display_name])));
        }
      } else {
        const n = await getProfilesLite(msgs.map((m) => m.user_id));
        setNames(n);
      }
    })();
    const channel = supabase.channel(`chat-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const m = payload.new as any;
          setMessages((prev) => [...prev, m]);
          if (m.pride_actor_id) {
            if (!prideNames[m.pride_actor_id]) {
              const idents = await getPrideIdentities([m.pride_actor_id]);
              setPrideNames((s) => ({ ...s, ...Object.fromEntries(Object.values(idents).map((i) => [i.pride_id, i.display_name])) }));
            }
          } else if (!names[m.user_id]) {
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
        <div className="text-sm font-semibold flex items-center gap-1.5">
          {isPride && <Sparkles className="h-4 w-4 text-fuchsia-500" />}
          {isPride ? "Pride group chat" : "Group chat"}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((m) => {
          const mine = m.user_id === me;
          const label = isPride
            ? (prideNames[m.pride_actor_id] ?? "Pride member")
            : (names[m.user_id]?.full_name ?? "Someone");
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <div className="text-[10px] font-medium opacity-70 mb-0.5">{label}</div>}
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
