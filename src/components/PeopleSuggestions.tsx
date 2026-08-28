import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, X, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { sendHuddleRequest } from "@/lib/huddle-connect";
import { getSuggestions, dismissSuggestion, invalidateSuggestionsCache, type Suggestion } from "@/lib/suggestions";

function reason(s: Suggestion) {
  if (s.mutuals > 0) return `${s.mutuals} mutual connection${s.mutuals > 1 ? "s" : ""}`;
  if (s.coEvents > 0) return `Met at ${s.coEvents} event${s.coEvents > 1 ? "s" : ""}`;
  if (s.sharedInterests.length > 0) return `${s.sharedInterests.length} shared interest${s.sharedInterests.length > 1 ? "s" : ""}`;
  if (s.sameCity && s.city) return `Lives in ${s.city}`;
  return "Suggested for you";
}

export function PeopleSuggestions({ variant = "rail" }: { variant?: "rail" | "grid" }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState<string>("All");

  useEffect(() => {
    (async () => {
      try {
        setItems(await getSuggestions());
      } catch { /* non-critical */ }
      finally { setLoading(false); }
    })();
  }, [variant]);

  const linkup = async (id: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await sendHuddleRequest(id);
      setSent((s) => new Set(s).add(id));
      invalidateSuggestionsCache();
      toast.success("Request sent");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  };

  const hide = async (id: string) => {
    setItems((list) => list.filter((s) => s.id !== id));
    try { await dismissSuggestion(id); } catch { /* ignore */ }
  };

  const interestTags = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((s) => s.sharedInterests.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; }));
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [items]);

  const filtered = useMemo(
    () => (tag === "All" ? items : items.filter((s) => s.sharedInterests.includes(tag))),
    [items, tag],
  );

  if (loading || items.length === 0) return null;

  const shown = variant === "rail" ? filtered.slice(0, 12) : filtered;

  const Card = (s: Suggestion) => (
    <div className="relative shrink-0 w-[150px] rounded-2xl border border-border bg-card p-3 shadow-sm">
      <button
        onClick={() => hide(s.id)}
        aria-label={`Hide ${s.full_name ?? "member"}`}
        className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <Link to="/u/$userId" params={{ userId: s.id }} className="block text-center">
        <div className="mx-auto w-fit">
          <Avatar photo={s.photo} name={s.full_name} size={64} />
        </div>
        <div className="mt-2 text-[13px] font-semibold truncate">{s.full_name ?? "Member"}</div>
        <div className="text-[11px] text-muted-foreground truncate">{reason(s)}</div>
      </Link>
      <button
        disabled={busy[s.id] || sent.has(s.id)}
        onClick={() => linkup(s.id)}
        className={`mt-2.5 w-full inline-flex items-center justify-center gap-1 rounded-full py-1.5 text-[12px] font-semibold disabled:opacity-60 ${
          sent.has(s.id) ? "bg-muted text-muted-foreground" : "bg-gradient-brand text-white"
        }`}
      >
        {sent.has(s.id) ? <><Check className="h-3.5 w-3.5" /> Sent</> : <><UserPlus className="h-3.5 w-3.5" /> Linkup</>}
      </button>
    </div>
  );

  const Filters = ({ pad }: { pad: string }) =>
    interestTags.length === 0 ? null : (
      <div className={`mt-2 flex gap-2 overflow-x-auto pb-1 ${pad} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {["All", ...interestTags].map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium border ${
              tag === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {t === "All" ? "All" : t}
          </button>
        ))}
      </div>
    );

  if (variant === "grid") {
    return (
      <div>
        <Filters pad="" />
        <div className="mt-2 flex flex-wrap gap-3">
          {shown.length === 0
            ? <div className="text-xs text-muted-foreground py-2">No suggestions for this interest.</div>
            : shown.map((s) => <Card key={s.id} {...s} />)}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-2">
      <div className="px-5 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> SUGGESTED PEOPLE
        </div>
        <Link to="/discover" className="text-xs font-semibold text-primary">See all</Link>
      </div>
      <Filters pad="px-5" />
      <div className="mt-2 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.length === 0
          ? <div className="text-xs text-muted-foreground py-2">No suggestions for this interest.</div>
          : shown.map((s) => <Card key={s.id} {...s} />)}
      </div>
    </section>
  );
}
