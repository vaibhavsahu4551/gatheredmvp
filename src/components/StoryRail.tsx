import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { getProfilesLite } from "@/lib/events";
import { listConnections } from "@/lib/huddle-connect";
import { loadBlockedIds } from "@/lib/safety";
import { listActiveStories, orderGroups, type StoryGroup } from "@/lib/stories";
import { StoryCreator } from "@/components/StoryCreator";
import { StoryViewer } from "@/components/StoryViewer";

type Profiles = Record<string, { full_name: string | null; photo: string | null }>;

/** Instagram-style story rings above the home feed. */
export function StoryRail() {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [profiles, setProfiles] = useState<Profiles>({});
  const [meId, setMeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [openAt, setOpenAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ groups: g, meId: me }, blocked] = await Promise.all([listActiveStories(), loadBlockedIds()]);
      const conns = me ? new Set(await listConnections(me)) : new Set<string>();
      const visible = g.filter((x) => !blocked.has(x.user_id));
      const ordered = orderGroups(visible, me, conns);
      setGroups(ordered);
      setMeId(me);
      if (ordered.length) setProfiles(await getProfilesLite(ordered.map((x) => x.user_id)) as Profiles);
    } catch { /* stories are non-critical for the feed */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mine = groups.find((g) => g.user_id === meId);

  return (
    <>
      <div className="flex gap-3.5 overflow-x-auto px-5 pb-1 pt-1">
        <button
          onClick={() => (mine ? setOpenAt(groups.indexOf(mine)) : setCreating(true))}
          className="shrink-0 flex flex-col items-center gap-1.5 w-16"
        >
          <div className="relative">
            {mine ? (
              <Ring viewed={mine.allViewed}>
                <Avatar photo={profiles[meId]?.photo} name={profiles[meId]?.full_name} size={56} className="!p-0 !bg-transparent" />
              </Ring>
            ) : (
              <div className="h-[62px] w-[62px] rounded-full border border-border bg-muted/40 flex items-center justify-center">
                <Avatar photo={profiles[meId]?.photo} name={profiles[meId]?.full_name} size={54} className="!p-0 !bg-transparent" />
              </div>
            )}
            <span
              onClick={(e) => { e.stopPropagation(); setCreating(true); }}
              className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-gradient-brand text-white flex items-center justify-center border-2 border-background"
            >
              <Plus className="h-3 w-3" />
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground truncate w-full text-center">Your story</span>
        </button>

        {groups.filter((g) => g.user_id !== meId).map((g) => (
          <button
            key={g.user_id}
            onClick={() => setOpenAt(groups.indexOf(g))}
            className="shrink-0 flex flex-col items-center gap-1.5 w-16"
          >
            <Ring viewed={g.allViewed}>
              <Avatar photo={profiles[g.user_id]?.photo} name={profiles[g.user_id]?.full_name} size={56} className="!p-0 !bg-transparent" />
            </Ring>
            <span className="text-[11px] text-muted-foreground truncate w-full text-center">
              {(profiles[g.user_id]?.full_name ?? "Someone").split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {creating && (
        <StoryCreator onClose={() => setCreating(false)} onPosted={() => { setCreating(false); load(); }} />
      )}
      {openAt !== null && groups[openAt] && (
        <StoryViewer
          groups={groups}
          startIndex={openAt}
          meId={meId}
          profiles={profiles}
          onClose={() => { setOpenAt(null); load(); }}
          onChanged={load}
        />
      )}
    </>
  );
}

function Ring({ viewed, children }: { viewed: boolean; children: React.ReactNode }) {
  return (
    <div className={`h-[62px] w-[62px] rounded-full p-[2px] ${viewed ? "bg-border" : "bg-gradient-brand"}`}>
      <div className="h-full w-full rounded-full bg-background p-[2px] flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  );
}
