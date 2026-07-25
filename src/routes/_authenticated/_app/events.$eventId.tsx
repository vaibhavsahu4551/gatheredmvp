import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countByGender, getEvent, getParticipants, getProfilesLite, listEventComments, myParticipation, postEventComment, requestJoin, setParticipantStatus, type EventComment, type EventRow, type ParticipantRow } from "@/lib/events";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, MapPin, Clock, Users, MessageCircle, Lock, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/events/$eventId")({
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string>("");
  const [event, setEvent] = useState<EventRow | null>(null);
  const [parts, setParts] = useState<ParticipantRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; gender: string | null }>>({});
  const [my, setMy] = useState<ParticipantRow | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

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

  if (!event) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const isHost = event.host_id === me;
  const counts = countByGender(parts);
  const approved = parts.filter((p) => p.status === "approved");
  const pending = parts.filter((p) => p.status === "pending");

  const doJoin = async () => {
    try { await requestJoin(eventId); toast.success("Request sent"); await load(); }
    catch (e: any) { toast.error(e.message); }
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
        {event.status === "confirmed" && groupId && (
          <Link to="/chat/$groupId" params={{ groupId }} className="rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 text-sm font-medium flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" /> Group chat
          </Link>
        )}
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          {event.event_type && (
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{event.event_type}</span>
          )}
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{event.category}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
        <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Hosted by {profiles[event.host_id]?.full_name ?? "Host"}
        </div>

        <div className={`mt-3 rounded-2xl p-3 text-sm ${event.status === "confirmed" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : event.status === "cancelled" ? "bg-red-50 text-red-800 border border-red-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
          {event.status === "confirmed" && "Confirmed — group chat unlocked."}
          {event.status === "pending" && `Waiting for more people — ${counts.total}/${event.min_size} joined.`}
          {event.status === "cancelled" && "This HUDDL was cancelled."}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <Row icon={<Clock className="h-4 w-4" />}>{new Date(event.starts_at).toLocaleString()}</Row>
          <Row icon={<MapPin className="h-4 w-4" />}>{event.location_address}</Row>
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
              <div key={p.id} className="text-sm text-muted-foreground">{profiles[p.user_id]?.full_name ?? "Someone"} · {profiles[p.user_id]?.gender ?? "—"}</div>
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
                  <div className="text-sm">
                    <div className="font-medium">{profiles[p.user_id]?.full_name ?? "Someone"}</div>
                    <div className="text-xs text-muted-foreground">{profiles[p.user_id]?.gender ?? "—"}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => decide(p.id, "rejected")} className="rounded-full border border-border px-3 py-1.5 text-xs">Reject</button>
                    <button onClick={() => decide(p.id, "approved")} className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs">Approve</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-muted-foreground"><span className="text-foreground/70">{icon}</span>{children}</div>;
}
