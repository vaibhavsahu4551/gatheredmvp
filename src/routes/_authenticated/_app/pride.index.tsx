import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ShieldAlert, Plus } from "lucide-react";
import { loadMe } from "@/lib/huddl";
import {
  listPrideEvents,
  getParticipantsForEvents,
  countByGender,
  type EventRow,
} from "@/lib/events";
import { getPrideIdentities, loadMyPrideProfile } from "@/lib/pride";
import { EventCard } from "@/components/EventCard";

export const Route = createFileRoute("/_authenticated/_app/pride/")({
  component: PrideScreen,
});

function PrideScreen() {
  const navigate = useNavigate();
  const [ok, setOk] = useState<null | boolean>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { boys: number; girls: number; total: number }>>({});
  const [hosts, setHosts] = useState<Record<string, { display_name: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await loadMe();
      if (!me?.profile?.pride_opt_in) {
        navigate({ to: "/home", replace: true });
        return;
      }
      const identity = await loadMyPrideProfile();
      if (!identity) {
        navigate({ to: "/pride/setup", replace: true });
        return;
      }
      setOk(true);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!ok) return;
    (async () => {
      setLoading(true);
      try {
        const ev = await listPrideEvents({ limit: 100 });
        setEvents(ev);
        const pmap = await getParticipantsForEvents(ev.map((e) => e.id));
        const c: Record<string, { boys: number; girls: number; total: number }> = {};
        for (const e of ev) {
          const { boys, girls, total } = countByGender(pmap[e.id] ?? []);
          c[e.id] = { boys, girls, total };
        }
        setCounts(c);
        const prideIds = ev.map((e) => (e as any).pride_actor_id).filter(Boolean) as string[];
        const idents = await getPrideIdentities(prideIds);
        const hostMap: Record<string, { display_name: string }> = {};
        for (const e of ev) {
          const pid = (e as any).pride_actor_id as string | null;
          if (pid && idents[pid]) hostMap[e.id] = { display_name: idents[pid].display_name };
        }
        setHosts(hostMap);
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
          A private space for LGBTQ+ members. In here you appear as your Pride identity — never
          your real name or main profile.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-[12px]">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
          <div>
            Tap <span className="font-semibold">•••</span> on any event to report content. No
            nudity or explicit content is allowed — every uploaded photo is automatically checked.
            Repeated violations suspend Pride access.
          </div>
        </div>
        <div className="mt-3">
          <Link to="/pride/setup" className="text-[12px] font-medium text-fuchsia-600 hover:underline">
            Edit my Pride identity
          </Link>
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
          <EventCard key={e.id} e={e} c={counts[e.id]} prideHost={hosts[e.id] ?? null} />
        ))}
      </div>
    </div>
  );
}
