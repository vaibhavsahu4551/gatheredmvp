import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { eventTypeStyle } from "@/lib/event-style";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countByGender, deleteEvent, getEvent, getParticipants, getProfilesLite, listEventComments, myParticipation, postEventComment, requestJoin, setParticipantStatus, type EventComment, type EventRow, type ParticipantRow } from "@/lib/events";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Clock, Users, MessageCircle, Lock, Send, Pencil, Trash2 } from "lucide-react";
import { SafetyMenu } from "@/components/SafetyMenu";
import { Avatar } from "@/components/Avatar";


export const Route = createFileRoute("/_authenticated/_app/events/$eventId")({
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string>("");
  const [event, setEvent] = useState<EventRow | null>(null);
  const [parts, setParts] = useState<ParticipantRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; gender: string | null; photo: string | null }>>({});
  const [my, setMy] = useState<ParticipantRow | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const ev = await getEvent(eventId);
    setEvent(ev);
    const ps = await getParticipants(eventId);
    setParts(ps);
    const ids = Array.from(new Set([...(ev ? [ev.host_id] : []), ...ps.map((p) => p.user_id)]));
    setProfiles(await getProfilesLite(ids));
    setMy((await myParticipation(eventId, user.id)) as ParticipantRow | null);
    const { data: g } = await supabase.from("chat_groups").select("id").eq("event_id", eventId).maybeSingle();
    setGroupId(g?.id ?? null);
  };
  useEffect(() => { load(); }, [eventId]);

  const canDiscuss = !!event && (event.host_id === me || my?.status === "approved");

  useEffect(() => {
    if (!canDiscuss) { setComments([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const list = await listEventComments(eventId);
        if (cancelled) return;
        setComments(list);
        const ids = Array.from(new Set(list.map((c) => c.user_id)));
        if (ids.length) {
          const p = await getProfilesLite(ids);
          setProfiles((prev) => ({ ...prev, ...p }));
        }
      } catch (e) { /* RLS may reject briefly during transitions */ }
    })();
    const channel = supabase.channel(`event-comments-${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_comments", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const c = payload.new as EventComment;
          setComments((prev) => prev.some((x) => x.id === c.id) ? prev : [...prev, c]);
          setProfiles((prev) => {
            if (prev[c.user_id]) return prev;
            getProfilesLite([c.user_id]).then((p) => setProfiles((s) => ({ ...s, ...p })));
            return prev;
          });
        }).subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [eventId, canDiscuss]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [comments.length]);

  if (!event) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const isHost = event.host_id === me;
  const counts = countByGender(parts);
  const approved = parts.filter((p) => p.status === "approved");
  const pending = parts.filter((p) => p.status === "pending");

  const sendComment = async () => {
    const body = commentText.trim();
    if (!body || sending) return;
    setSending(true);
    setCommentText("");
    try { await postEventComment(eventId, body); }
    catch (e: any) { toast.error(e.message ?? "Failed to send"); setCommentText(body); }
    finally { setSending(false); }
  };

  const doJoin = async () => {
    try { await requestJoin(eventId); toast.success("Request sent"); await load(); }
    catch (e: any) {
      console.error("Join failed", e);
      toast.error(e?.message || e?.error_description || "Couldn't send request. Please try again.");
    }
  };
  const decide = async (id: string, s: "approved" | "rejected") => {
    await setParticipantStatus(id, s); await load();
  };

  return (
    <div className="pb-24">
      <div className="px-5 pt-6 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/home" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          {event.status === "confirmed" && groupId && (
            <Link to="/chat/$groupId" params={{ groupId }} className="rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 text-sm font-medium flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> Group chat
            </Link>
          )}
          {isHost && (
            <>
              <Link
                to="/events/$eventId/edit"
                params={{ eventId: event.id }}
                className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
                aria-label="Edit event"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                onClick={async () => {
                  if (!confirm("Delete this event? All requests, attendees, comments, and the group chat will be removed.")) return;
                  try {
                    await deleteEvent(event.id);
                    toast.success("Event deleted");
                    navigate({ to: "/events" });
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not delete event");
                  }
                }}
                className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-destructive"
                aria-label="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          {!isHost && (
            <SafetyMenu targetType="event" targetId={event.id} userId={event.host_id} />
          )}
        </div>
      </div>



      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          {event.event_type && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm"
              style={{ backgroundImage: eventTypeStyle(event.event_type).gradient }}
            >{event.event_type}</span>

          )}
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{event.category}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          Hosted by {profiles[event.host_id]?.full_name ?? "Host"}
        </div>

        <div className={`mt-3 rounded-2xl p-3 text-sm ${event.status === "confirmed" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : event.status === "cancelled" ? "bg-red-50 text-red-800 border border-red-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
          {event.status === "confirmed" && "Confirmed — group chat unlocked."}
          {event.status === "pending" && `Waiting for more people — ${counts.total}/${event.min_size} joined.`}
          {event.status === "cancelled" && "This Gathr was cancelled."}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <Row icon={<Clock className="h-4 w-4" />}>{new Date(event.starts_at).toLocaleString()}</Row>
          <Row icon={<MapPin className="h-4 w-4" />}>{event.location_address}</Row>
          {(event as any).exact_location && (event.host_id === me || my?.status === "approved") && (
            <div className="ml-6 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[13px] text-emerald-900">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Exact meeting point</div>
              <div className="mt-0.5">{(event as any).exact_location}</div>
            </div>
          )}
          <Row icon={<Users className="h-4 w-4" />}>{counts.boys} boys, {counts.girls} girls joined / max {event.max_size}</Row>
          {(event.entry_fee ?? 0) > 0 && <Row icon={<span className="text-sm">₹</span>}>{event.entry_fee}</Row>}
        </div>


        {event.description && <p className="mt-4 text-[14px] text-foreground/90 whitespace-pre-wrap">{event.description}</p>}

        {!isHost && (
          <div className="mt-6">
            {my?.status === "approved" && <div className="w-full rounded-full bg-emerald-500 text-white py-3 text-sm text-center font-medium">You're in ✓</div>}
            {my?.status === "pending" && <div className="w-full rounded-full bg-muted text-foreground py-3 text-sm text-center font-medium">Request pending</div>}
            {my?.status === "rejected" && <div className="w-full rounded-full bg-red-100 text-red-700 py-3 text-sm text-center font-medium">Request declined</div>}
            {!my && event.status !== "cancelled" && (
              <button onClick={doJoin} className="w-full rounded-full bg-primary text-primary-foreground py-3.5 text-sm font-medium">Request to Join</button>
            )}
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-sm font-semibold">Going ({approved.length})</h3>
          <div className="mt-2 space-y-1.5">
            {approved.map((p) => (
              <Link key={p.id} to="/u/$userId" params={{ userId: p.user_id }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Avatar photo={profiles[p.user_id]?.photo} name={profiles[p.user_id]?.full_name} size={28} />
                <span>{profiles[p.user_id]?.full_name ?? "Someone"} · {profiles[p.user_id]?.gender ?? "—"}</span>
              </Link>
            ))}
            {approved.length === 0 && <div className="text-sm text-muted-foreground">No one yet.</div>}
          </div>
        </div>

        {isHost && pending.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Requests ({pending.length})</h3>
            <div className="mt-2 space-y-2">
              {pending.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border p-3">
                  <Link to="/u/$userId" params={{ userId: p.user_id }} className="text-sm min-w-0 flex-1">
                    <div className="font-medium truncate">{profiles[p.user_id]?.full_name ?? "Someone"}</div>
                    <div className="text-xs text-muted-foreground">{profiles[p.user_id]?.gender ?? "—"}</div>
                  </Link>
                  <div className="flex gap-2">
                    <button onClick={() => decide(p.id, "rejected")} className="rounded-full border border-border px-3 py-1.5 text-xs">Reject</button>
                    <button onClick={() => decide(p.id, "approved")} className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs">Approve</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" /> Discussion
          </h3>
          {!canDiscuss ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border p-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> Join this event to see the discussion
            </div>
          ) : (
            <div className="mt-2 rounded-2xl border border-border bg-card">
              <div className="max-h-80 overflow-y-auto p-3 space-y-3">
                {comments.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">No messages yet. Say hi 👋</div>
                )}
                {comments.map((c) => {
                  const name = profiles[c.user_id]?.full_name ?? "Someone";
                  const initial = (name?.[0] ?? "?").toUpperCase();
                  const mine = c.user_id === me;
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <Link to="/u/$userId" params={{ userId: c.user_id }} className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-foreground/70">
                        {initial}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          {mine ? (
                            <span className="text-[13px] font-medium truncate">You</span>
                          ) : (
                            <Link to="/u/$userId" params={{ userId: c.user_id }} className="text-[13px] font-medium truncate hover:underline">{name}</Link>
                          )}
                          <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</span>
                        </div>
                        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{c.body}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={commentsEndRef} />
              </div>
              <div className="border-t border-border p-2 flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendComment(); } }}
                  placeholder="Write a message…"
                  className="flex-1 rounded-full bg-background border border-border px-4 py-2 text-sm outline-none"
                />
                <button
                  onClick={sendComment}
                  disabled={sending || !commentText.trim()}
                  className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-muted-foreground"><span className="text-foreground/70">{icon}</span>{children}</div>;
}
