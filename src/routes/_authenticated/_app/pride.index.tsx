import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ShieldAlert, Plus } from "lucide-react";
import { loadMe } from "@/lib/huddl";
import { supabase } from "@/integrations/supabase/client";
import {
  listPrideEvents,
  listHostedEvents,
  listJoinedEvents,
  getParticipantsForEvents,
  countByGender,
  type EventRow,
} from "@/lib/events";
import { getPrideIdentities, loadMyPrideProfile, type PrideIdentity } from "@/lib/pride";
import { EventCard } from "@/components/EventCard";


export const Route = createFileRoute("/_authenticated/_app/pride/")({
  component: PrideScreen,
});

function PrideScreen() {
  const navigate = useNavigate();
  const [ok, setOk] = useState<null | boolean>(null);
  const [tab, setTab] = useState<"discover" | "hosting" | "joined">("discover");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [hosting, setHosting] = useState<EventRow[]>([]);
  const [joined, setJoined] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { boys: number; girls: number; total: number }>>({});
  const [prideHosts, setPrideHosts] = useState<Record<string, PrideIdentity>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await loadMe();
      const opted = !!me?.profile?.pride_opt_in;
      if (!opted) {
        setOk(false);
        navigate({ to: "/home", replace: true });
        return;
      }
      const ident = await loadMyPrideProfile();
      if (!ident) {
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
        const { data: { user } } = await supabase.auth.getUser();
        const [ev, h, j] = await Promise.all([
          listPrideEvents({ limit: 100 }),
          user ? listHostedEvents(user.id, { pride: true }) : Promise.resolve([]),
          user ? listJoinedEvents(user.id, { pride: true }) : Promise.resolve([]),
        ]);
        setEvents(ev);
        setHosting(h);
        setJoined(j);
        const all = [...ev, ...h, ...j];
        const pmap = await getParticipantsForEvents(all.map((e) => e.id));
        const c: Record<string, { boys: number; girls: number; total: number }> = {};
        for (const e of all) {
          const { boys, girls, total } = countByGender(pmap[e.id] ?? []);
          c[e.id] = { boys, girls, total };
        }
        setCounts(c);
        const prideIds = all.map((e) => (e as any).pride_actor_id).filter(Boolean) as string[];
        if (prideIds.length) setPrideHosts(await getPrideIdentities(prideIds));
      } finally { setLoading(false); }
    })();
  }, [ok]);

  if (ok === null) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }
  if (!ok) return null;

  const list = tab === "discover" ? events : tab === "hosting" ? hosting : joined;

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
          A private space for LGBTQ+ members. Your real profile is never shown here — only your Pride identity.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-[12px]">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
          <div>
            Safety first. Tap the <span className="font-semibold">•••</span> on any event to report.
            No nudity or sexually explicit content — uploads are auto-moderated. Exact meeting points appear only after host approval.
          </div>
        </div>
      </header>

      <div className="px-5 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
          {(["discover","hosting","joined"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full font-medium ${tab === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {t === "discover" ? "Discover" : t === "hosting" ? "Your Hosted" : "Your Joined"}
            </button>
          ))}
        </div>
        <Link
          to="/create"
          className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </div>

      <div className="mt-3 px-5 space-y-3 pb-8">
        {loading && <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>}
        {!loading && list.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {tab === "discover"
              ? "No Pride events yet. Be the first to host one — toggle \"Post in Pride section\" when you create."
              : tab === "hosting"
                ? "You haven't hosted any Pride events yet."
                : "You haven't joined any Pride events yet."}
          </div>
        )}
        {list.map((e) => {
          const pid = (e as any).pride_actor_id as string | undefined;
          const prideHost = pid ? prideHosts[pid] : undefined;
          return <EventCard key={e.id} e={e} c={counts[e.id]} prideHost={prideHost} />;
        })}
      </div>
    </div>
  );
}

