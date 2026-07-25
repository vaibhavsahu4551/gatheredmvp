import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listIncomingRequests, respondHuddleRequest } from "@/lib/huddle-connect";
import { getProfilesLite } from "@/lib/events";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Check, X, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/requests")({
  component: Requests,
});

function Requests() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await listIncomingRequests();
    setRows(r);
    if (r.length) setNames(await getProfilesLite(r.map((x: any) => x.from_id)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, accept: boolean) => {
    try {
      await respondHuddleRequest(id, accept);
      toast.success(accept ? "Linked up!" : "Declined");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <div>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/profile" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Linkup requests</h1>
      </header>
      <div className="px-5 space-y-2">
        {loading && <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No pending requests.</p>
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 bg-card">
            <Link to="/u/$userId" params={{ userId: r.from_id }} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar photo={names[r.from_id]?.photo} name={names[r.from_id]?.full_name} size={44} />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{names[r.from_id]?.full_name ?? "Member"}</div>
                <div className="text-[11px] text-muted-foreground">wants to Linkup</div>
              </div>
            </Link>
            <button onClick={() => act(r.id, true)} className="h-9 w-9 rounded-full bg-gradient-brand text-white flex items-center justify-center">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => act(r.id, false)} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
