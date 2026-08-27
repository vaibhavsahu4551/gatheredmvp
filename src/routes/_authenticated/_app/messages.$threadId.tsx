import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listDm, sendDm, markDmRead } from "@/lib/dm";
import { sendDmVoice } from "@/lib/voice";
import { getProfilesLite } from "@/lib/events";
import { Avatar } from "@/components/Avatar";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { VoiceNoteBubble } from "@/components/VoiceNoteBubble";
import { ArrowLeft, Send, Link2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/messages/$threadId")({
  component: DmRoom,
});

const sb: any = supabase;

function DmRoom() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState("");
  const [other, setOther] = useState<{ id: string; name: string; photo: string | null } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [shared, setShared] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: t } = await sb.from("dm_threads").select("user_a, user_b").eq("id", threadId).maybeSingle();
      if (t) {
        const otherId = t.user_a === user.id ? t.user_b : t.user_a;
        const n = await getProfilesLite([otherId]);
        const info = (n as any)[otherId];
        setOther({ id: otherId, name: info?.full_name ?? "Member", photo: info?.photo ?? null });
      }
      const msgs = await listDm(threadId);
      setMessages(msgs);
      await hydrateShares(msgs);
      markDmRead(threadId).catch(() => {});
    })();

    const channel = supabase.channel(`dm-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
        async (payload) => {
          const m = payload.new as any;
          setMessages((prev) => [...prev, m]);
          await hydrateShares([m]);
          markDmRead(threadId).catch(() => {});
        }).subscribe();
    return () => {
      supabase.removeChannel(channel);
      markDmRead(threadId).catch(() => {});
    };
  }, [threadId]);

  const hydrateShares = async (msgs: any[]) => {
    const eventIds = msgs.filter((m) => m.share_kind === "event" && m.share_id).map((m) => m.share_id);
    const postIds = msgs.filter((m) => m.share_kind === "post" && m.share_id).map((m) => m.share_id);
    const upd: Record<string, any> = {};
    if (eventIds.length) {
      const { data } = await sb.from("events").select("id, title, event_type").in("id", eventIds);
      for (const e of data ?? []) upd[`event:${e.id}`] = e;
    }
    if (postIds.length) {
      const { data } = await sb.from("posts").select("id, caption, photo_url, user_id").in("id", postIds);
      const authorIds = Array.from(new Set((data ?? []).map((p: any) => p.user_id).filter(Boolean))) as string[];
      const authors = authorIds.length ? await getProfilesLite(authorIds) : {};
      const { signedFeedUrl } = await import("@/lib/feed");
      for (const p of data ?? []) {
        const thumb = p.photo_url ? await signedFeedUrl(p.photo_url) : "";
        upd[`post:${p.id}`] = { ...p, author: (authors as any)[p.user_id], thumb };
      }
    }
    if (Object.keys(upd).length) setShared((s) => ({ ...s, ...upd }));
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const body = text.trim(); setText("");
    try { await sendDm(threadId, body); } catch { setText(body); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 pt-6 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate({ to: "/messages" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        {other ? (
          <Link to="/u/$userId" params={{ userId: other.id }} className="flex items-center gap-2">
            <Avatar photo={other.photo} name={other.name} size={32} />
            <div className="text-sm font-semibold">{other.name}</div>
          </Link>
        ) : <div className="text-sm">Chat</div>}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === me;
          const sk = m.share_kind ? shared[`${m.share_kind}:${m.share_id}`] : null;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {sk && m.share_kind === "event" && (
                  <Link to="/events/$eventId" params={{ eventId: m.share_id }}
                    className={`block mb-1 rounded-xl px-2 py-1.5 text-[12px] font-semibold ${mine ? "bg-white/20" : "bg-background"}`}>
                    <Link2 className="inline h-3 w-3 mr-1" />
                    {sk.event_type ? `${sk.event_type} · ${sk.title}` : sk.title}
                  </Link>
                )}
                {sk && m.share_kind === "post" && (
                  <Link to="/posts/$postId" params={{ postId: m.share_id }}
                    className={`flex gap-2 mb-1 rounded-xl p-2 ${mine ? "bg-white/20" : "bg-background"}`}>
                    {sk.thumb ? (
                      <img src={sk.thumb} alt="" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] opacity-80 font-semibold truncate">
                        {sk.author?.full_name ?? "Post"}
                      </div>
                      <div className="text-[12px] line-clamp-2 opacity-90">
                        {sk.caption?.slice(0, 80) ?? (sk.thumb ? "Photo" : "Shared post")}
                      </div>
                    </div>
                  </Link>
                )}
                {m.voice_url && (
                  <VoiceNoteBubble path={m.voice_url} durationMs={m.voice_duration_ms} mine={mine} />
                )}
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3 flex gap-2 pb-6 items-center relative">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…" className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none" />
        <VoiceRecorder onSent={(path, dur) => sendDmVoice(threadId, path, dur)} />
        <button onClick={send} className="h-10 w-10 rounded-full bg-gradient-brand text-white flex items-center justify-center">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
