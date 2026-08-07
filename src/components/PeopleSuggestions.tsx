import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, X, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { signedPhotoUrl } from "@/lib/huddl";
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
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await getSuggestions();
        setItems(list);
        const entries = await Promise.all(
          list.slice(0, variant === "rail" ? 12 : 40)
            .filter((s) => s.photo)
            .map(async (s) => [s.id, await signedPhotoUrl(s.photo!)] as const),
        );
        setPhotos(Object.fromEntries(entries));
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

  if (loading || items.length === 0) return null;

  const shown = variant === "rail" ? items.slice(0, 12) : items;

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
          <Avatar photoUrl={photos[s.id]} photo={s.photo} name={s.full_name} size={64} />
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

  if (variant === "grid") {
    return (
      <div className="flex flex-wrap gap-3">
        {shown.map((s) => <Card key={s.id} {...s} />)}
      </div>
    );
  }

  return (
    <section className="mt-2">
      <div className="px-5 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> PEOPLE YOU MAY KNOW
        </div>
        <Link to="/discover" className="text-xs font-semibold text-primary">See all</Link>
      </div>
      <div className="mt-2 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.map((s) => <Card key={s.id} {...s} />)}
      </div>
    </section>
  );
}
