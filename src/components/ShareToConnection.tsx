import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { listConnections } from "@/lib/huddle-connect";
import { getProfilesLite } from "@/lib/events";
import { shareToConnection } from "@/lib/dm";
import { Share2, X, Send, Link2, Smartphone } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export function shareUrlFor(kind: "post" | "event", id: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/${kind === "event" ? "events" : "posts"}/${id}`;
}

export function ShareButton({ kind, id }: { kind: "post" | "event"; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 p-1.5 text-current hover:opacity-80 text-[12px]"
        aria-label="Share"
      >
        <Share2 className="h-4 w-4" />
      </button>
      {open && <SharePicker kind={kind} id={id} onClose={() => setOpen(false)} />}
    </>
  );
}

function SharePicker({ kind, id, onClose }: { kind: "post" | "event"; id: string; onClose: () => void }) {
  const [connIds, setConnIds] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const url = shareUrlFor(kind, id);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const ids = await listConnections(user.id);
        setConnIds(ids);
        if (ids.length) setNames(await getProfilesLite(ids) as any);
      } catch (e: any) {
        console.error("Share picker load failed", e);
      }
    })();
  }, []);

  const toggle = (uid: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  };

  const send = async () => {
    if (!selected.size) return;
    setSending(true);
    try {
      for (const uid of selected) await shareToConnection(uid, kind, id, note);
      toast.success(`Shared with ${selected.size} connection${selected.size > 1 ? "s" : ""}`);
      onClose();
    } catch (e: any) {
      console.error("Share failed", e);
      toast.error(e.message ?? "Could not share");
    } finally { setSending(false); }
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: kind === "event" ? "Join this Gathr" : "Check out this post", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
      onClose();
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      catch { toast.error("Could not share the link"); }
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); onClose(); }
    catch { toast.error("Could not copy the link"); }
  };

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  const body = (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { stop(e); onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-4 shadow-elevated" onClick={stop}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-semibold">Share</div>
          <button onClick={(e) => { stop(e); onClose(); }} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={(e) => { stop(e); nativeShare(); }} className="rounded-xl border border-border py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2">
            <Smartphone className="h-4 w-4" /> Share via…
          </button>
          <button onClick={(e) => { stop(e); copyLink(); }} className="rounded-xl border border-border py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2">
            <Link2 className="h-4 w-4" /> Copy link
          </button>
        </div>

        <div className="text-xs font-semibold text-muted-foreground mb-2">Send to a Linkup</div>
        {connIds.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            You have no Linkup connections yet.
          </div>
        ) : (
          <>
            <div className="max-h-56 overflow-y-auto space-y-1 mb-3">
              {connIds.map((uid) => (
                <button
                  key={uid}
                  onClick={(e) => { stop(e); toggle(uid); }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition ${selected.has(uid) ? "bg-gradient-brand-soft" : "hover:bg-muted"}`}
                >
                  <Avatar photo={names[uid]?.photo} name={names[uid]?.full_name} size={36} />
                  <div className="text-sm font-medium flex-1 truncate">{names[uid]?.full_name ?? "Member"}</div>
                  <div className={`h-5 w-5 rounded-full border-2 ${selected.has(uid) ? "border-primary bg-primary" : "border-border"}`} />
                </button>
              ))}
            </div>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              onClick={stop}
              placeholder="Add a note (optional)"
              className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm mb-3"
            />
            <button
              disabled={!selected.size || sending}
              onClick={(e) => { stop(e); send(); }}
              className="w-full rounded-full bg-gradient-brand text-white py-2.5 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}
