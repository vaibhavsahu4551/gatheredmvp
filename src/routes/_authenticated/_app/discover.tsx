import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, Sparkles, UserPlus, Check, Clock, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ageFromDob, signedPhotoUrl, type ProfileRow } from "@/lib/huddl";
import { loadBlockedIds } from "@/lib/safety";
import { huddleStatusWith, sendHuddleRequest, type HuddleStatus } from "@/lib/huddle-connect";
import { Avatar } from "@/components/Avatar";
import { PeopleSuggestions } from "@/components/PeopleSuggestions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/discover")({
  component: Discover,
  head: () => ({
    meta: [
      { title: "Discover people · Gathr" },
      { name: "description", content: "Find people who share your interests on Gathr." },
      { property: "og:title", content: "Discover people · Gathr" },
      { property: "og:description", content: "Find people who share your interests on Gathr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = ProfileRow & { _overlap: string[]; _photo?: string; _status: HuddleStatus; _reqId?: string };

function Discover() {
  const navigate = useNavigate();
  const [me, setMe] = useState<ProfileRow | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState<string>("All");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: myRows } = await (supabase as any).rpc("get_my_profile");
        const myP = Array.isArray(myRows) ? myRows[0] : myRows;
        const mine = (myP ?? null) as ProfileRow | null;
        setMe(mine);
        const myInterests = mine?.interests ?? [];
        if (!myInterests.length) { setRows([]); setLoading(false); return; }

        const blocked = await loadBlockedIds();
        const viewerPride = !!mine?.pride_opt_in;

        let q = supabase.from("profiles")
          .select("id, full_name, dob, gender, city, bio, interests, photos, pride_opt_in, onboarding_complete")
          .neq("id", user.id)
          .eq("onboarding_complete", true)
          .overlaps("interests", myInterests)
          .limit(200);
        if (!viewerPride) q = q.eq("pride_opt_in", false);
        const { data } = await q;

        const mineSet = new Set(myInterests);
        const filtered = (data ?? [])
          .filter((p: any) => !blocked.has(p.id))
          .map((p: any): Row => {
            const overlap = (p.interests ?? []).filter((i: string) => mineSet.has(i));
            return { ...p, _overlap: overlap, _status: "none" as HuddleStatus };
          })
          .filter((r) => r._overlap.length > 0)
          .sort((a, b) => b._overlap.length - a._overlap.length);

        // Photos + huddle statuses in parallel
        const enriched = await Promise.all(filtered.slice(0, 60).map(async (r) => {
          const photo = r.photos?.[0] ? await signedPhotoUrl(r.photos[0]) : "";
          const s = await huddleStatusWith(r.id);
          return { ...r, _photo: photo, _status: s.status, _reqId: s.requestId };
        }));
        setRows(enriched);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r._overlap.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [rows]);

  const visible = useMemo(() => tag === "All" ? rows : rows.filter((r) => r._overlap.includes(tag)), [rows, tag]);

  const doLinkup = async (id: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await sendHuddleRequest(id);
      toast.success("Linkup request sent");
      setRows((rs) => rs.map((r) => r.id === id ? { ...r, _status: "outgoing" } : r));
    } catch (e: any) {
      toast.error(e.message ?? "Could not send");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-2">
          <button onClick={() => history.back()} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold">Discover people</h1>
            <p className="text-[11px] text-muted-foreground">People who share your interests</p>
          </div>
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
      </header>

      <div className="max-w-md mx-auto">
        <div className="px-4 mt-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">PEOPLE YOU MAY KNOW</div>
          <PeopleSuggestions variant="grid" />
        </div>

        {me && (me.interests?.length ?? 0) > 0 && (
          <div className="px-4 mt-3 flex gap-2 overflow-x-auto pb-2">
            {["All", ...allTags].map((t) => (
              <button key={t} onClick={() => setTag(t)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border ${tag === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="p-8 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
          </div>
        )}

        {!loading && (!me?.interests?.length) && (
          <div className="p-8 text-center space-y-3">
            <div className="text-sm text-muted-foreground">Add interests to your profile to discover like-minded people.</div>
            <Link to="/profile/edit" className="inline-block rounded-full bg-gradient-brand text-white px-4 py-2 text-sm font-medium">Edit profile</Link>
          </div>
        )}

        {!loading && me?.interests?.length && visible.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No one found yet. Try a different interest.
          </div>
        )}

        <div className="p-4 space-y-3">
          {visible.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="flex gap-3">
                <Link to="/u/$userId" params={{ userId: r.id }} className="shrink-0">
                  <Avatar photo={r._photo} name={r.full_name ?? ""} size={64} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to="/u/$userId" params={{ userId: r.id }} className="block">
                    <div className="font-semibold truncate">
                      {r.full_name || "Member"}
                      {r.dob && <span className="text-muted-foreground font-medium">, {ageFromDob(r.dob)}</span>}
                    </div>
                    {r.city && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />{r.city}
                      </div>
                    )}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[11px] text-muted-foreground mr-1">You both like:</span>
                    {r._overlap.slice(0, 5).map((t) => (
                      <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gradient-brand-soft text-gradient-brand">
                        {t}
                      </span>
                    ))}
                    {r._overlap.length > 5 && (
                      <span className="text-[11px] text-muted-foreground">+{r._overlap.length - 5}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                {r._status === "connected" ? (
                  <button onClick={() => navigate({ to: "/u/$userId", params: { userId: r.id } })}
                    className="rounded-full bg-muted text-foreground text-xs font-semibold px-3.5 py-1.5 inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> Linked
                  </button>
                ) : r._status === "outgoing" ? (
                  <button disabled className="rounded-full bg-muted text-muted-foreground text-xs font-semibold px-3.5 py-1.5 inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Requested
                  </button>
                ) : r._status === "incoming" ? (
                  <button onClick={() => navigate({ to: "/requests" })}
                    className="rounded-full bg-foreground text-background text-xs font-semibold px-3.5 py-1.5 inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Respond
                  </button>
                ) : (
                  <button onClick={() => doLinkup(r.id)} disabled={busy[r.id]}
                    className="rounded-full bg-gradient-brand text-white text-xs font-semibold px-3.5 py-1.5 inline-flex items-center gap-1 disabled:opacity-60">
                    <UserPlus className="h-3.5 w-3.5" /> {busy[r.id] ? "Sending…" : "Linkup"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
