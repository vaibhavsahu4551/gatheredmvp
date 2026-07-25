import { useEffect, useRef, useState } from "react";
import { X, Search, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type CityHit = { label: string; city: string };

export function CityPickerModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (city: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CityHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    if (!open) { setQ(""); setHits([]); setErr(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&featuretype=city&q=${encodeURIComponent(term)}`,
          { headers: { Accept: "application/json" }, signal: ctl.signal }
        );
        const j = await r.json();
        const seen = new Set<string>();
        const out: CityHit[] = [];
        for (const row of j as any[]) {
          const a = row.address ?? {};
          const city = a.city || a.town || a.village || a.municipality || a.county || a.state || row.name;
          if (!city) continue;
          const region = [a.state, a.country].filter(Boolean).join(", ");
          const label = region ? `${city}, ${region}` : city;
          if (seen.has(label)) continue;
          seen.add(label);
          out.push({ label, city });
        }
        setHits(out);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr("Search failed");
      } finally { setLoading(false); }
    }, 300);
    return () => { ctl.abort(); clearTimeout(t); };
  }, [q, open]);

  const save = async (city: string) => {
    setSaving(true); setErr(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ city }).eq("id", user.id);
      if (error) throw error;
      onSaved(city);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Set your city</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search a city…"
              className="w-full rounded-full border border-border bg-muted/40 pl-9 pr-4 py-2.5 text-sm" />
          </div>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
          {loading && <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!loading && q.trim().length >= 2 && hits.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">No cities found</div>
          )}
          {!loading && q.trim().length < 2 && (
            <div className="text-sm text-muted-foreground text-center py-6">Type at least 2 characters</div>
          )}
          {hits.map((h) => (
            <button key={h.label} disabled={saving} onClick={() => save(h.city)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted text-left disabled:opacity-60">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm">{h.label}</span>
            </button>
          ))}
          {err && <div className="text-xs text-destructive text-center py-2">{err}</div>}
        </div>
      </div>
    </div>
  );
}
