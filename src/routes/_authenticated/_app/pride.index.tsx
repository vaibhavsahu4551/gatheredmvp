import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ShieldAlert, Plus } from "lucide-react";
import { loadMe } from "@/lib/huddl";
import {
  listPrideEvents,
  getParticipantsForEvents,
  getProfilesLite,
  countByGender,
  type EventRow,
} from "@/lib/events";
import { EventCard } from "@/components/EventCard";

export const Route = createFileRoute("/_authenticated/_app/pride/")({
  component: PrideScreen,
});

function PrideScreen() {
  const navigate = useNavigate();
  const [ok, setOk] = useState<null | boolean>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { boys: number; girls: number; total: number }>>({});
  const [hosts, setHosts] = useState<Record<string, { full_name: string | null; gender: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMe().then((me) => {
      const opted = !!me?.profile?.pride_opt_in;
      setOk(opted);
      if (!opted) {
        // No trace: bounce out for anyone not opted in.
        navigate({ to: "/home", replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!ok) return;
    (async () => {
      setLoading(true);
      try {
        const ev = await listPrideEvents({ limit: 100 });
        setEvents(ev);
        const [pmap, hmap] = await Promise.all([
          getParticipantsForEvents(ev.map((e) => e.id)),
          getProfilesLite(ev.map((e) => e.host_id)),
        ]);
        const c: Record<string, { boys: number; girls: number; total: number }> = {};
        for (const e of ev) {
          const { boys, girls, total } = countByGender(pmap[e.id] ?? []);
          c[e.id] = { boys, girls, total };
        }
        setCounts(c);
        setHosts(hmap);
      } finally { setLoading(false); }
    })();
  }, [ok]);

  if (ok === null) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }
  if (!ok) return null;

  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500 flex items-center justify-center shadow-glow">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Pride</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          A private space for LGBTQ+ members to organize house parties and social events.
          Everything here stays inside Pride.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-[12px]">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
          <div>
            Your safety matters. Tap the <span className="font-semibold">•••</span> on any event or profile to
            report or block. Exact meeting points are only shared after the host approves you.
          </div>
        </div>
      </header>

      <div className="px-5 flex items-center justify-between">
        <div className="text-sm font-semibold">Happening in Pride</div>
        <Link
          to="/create"
          className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> New event
        </Link>
      </div>

      <div className="mt-3 px-5 space-y-3 pb-8">
        {loading && <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>}
        {!loading && events.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            No Pride events yet. Be the first to host one — toggle "Post in Pride section" when you create.
          </div>
        )}
        {events.map((e) => (
          <EventCard key={e.id} e={e} c={counts[e.id]} host={hosts[e.host_id]} />
        ))}
      </div>
    </div>
  );
}
