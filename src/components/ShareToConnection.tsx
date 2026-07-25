import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listConnections } from "@/lib/huddle-connect";
import { getProfilesLite } from "@/lib/events";
import { shareToConnection } from "@/lib/dm";
import { Share2, X, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export function ShareButton({ kind, id }: { kind: "post" | "event"; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-[12px]"
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
  const [names, setNames] = useState<Record<string, { full_name: string | null }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ids = await listConnections(user.id);
      setConnIds(ids);
      if (ids.length) setNames(await getProfilesLite(ids));
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
      toast.error(e.message ?? "Could not share");
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-4 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-semibold">Share with connections</div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        {connIds.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            You have no Huddle Up connections yet.
          </div>
        ) : (
          <>
            <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
              {connIds.map((uid) => (
                <button
                  key={uid}
                  onClick={() => toggle(uid)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition ${selected.has(uid) ? "bg-gradient-brand-soft" : "hover:bg-muted"}`}
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-brand shrink-0" />
                  <div className="text-sm font-medium flex-1 truncate">{names[uid]?.full_name ?? "Member"}</div>
                  <div className={`h-5 w-5 rounded-full border-2 ${selected.has(uid) ? "border-primary bg-primary" : "border-border"}`} />
                </button>
              ))}
            </div>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm mb-3"
            />
            <button
              disabled={!selected.size || sending}
              onClick={send}
              className="w-full rounded-full bg-gradient-brand text-white py-2.5 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </>
        )}
      </div>
    </div>
  );
}
