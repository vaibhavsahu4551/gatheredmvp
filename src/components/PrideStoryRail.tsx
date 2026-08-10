import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { listActiveStories, orderGroups, type StoryGroup } from "@/lib/stories";
import { getPrideIdentities, signedPridePhotoUrl, loadMyPrideProfile } from "@/lib/pride";
import { StoryCreator } from "@/components/StoryCreator";
import { StoryViewer } from "@/components/StoryViewer";

type Profiles = Record<string, { full_name: string | null; photo: string | null }>;

/**
 * Story rings for the Pride section. Fully isolated from the main rail:
 * only `is_pride` stories are loaded, and they are labelled with the Pride
 * identity — never the real name or photo.
 */
export function PrideStoryRail() {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [profiles, setProfiles] = useState<Profiles>({});
  const [meId, setMeId] = useState("");
  const [hasIdentity, setHasIdentity] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openAt, setOpenAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ groups: g, meId: me }, mine] = await Promise.all([
        listActiveStories({ pride: true }),
        loadMyPrideProfile(),
      ]);
      setHasIdentity(!!mine);
      const ordered = orderGroups(g, me, new Set<string>());
      setGroups(ordered);
      setMeId(me);

      const ids = ordered.map((x) => x.prideActorId).filter(Boolean) as string[];
      const idents = await getPrideIdentities(ids);
      const map: Profiles = {};
      await Promise.all(
        ordered.map(async (grp) => {
          const ident = grp.prideActorId ? idents[grp.prideActorId] : undefined;
          map[grp.user_id] = {
            full_name: ident?.display_name ?? "Someone",
            photo: ident?.photo_path ? await signedPridePhotoUrl(ident.photo_path) : null,
          };
        }),
      );
      if (mine) {
        map[me] = {
          full_name: mine.display_name,
          photo: mine.photo_path ? await signedPridePhotoUrl(mine.photo_path) : null,
        };
      }
      setProfiles(map);
    } catch { /* stories are non-critical */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mine = groups.find((g) => g.user_id === meId);

  return (
    <>
      <div className="flex gap-3.5 overflow-x-auto px-5 pb-1 pt-1">
        {hasIdentity && (
          <button
            onClick={() => (mine ? setOpenAt(groups.indexOf(mine)) : setCreating(true))}
            className="shrink-0 flex flex-col items-center gap-1.5 w-16"
          >
            <div className="relative">
              <Ring viewed={!!mine?.allViewed} dim={!mine}>
                <Avatar photo={profiles[meId]?.photo} name={profiles[meId]?.full_name} size={56} className="!p-0 !bg-transparent" />
              </Ring>
              <span
                onClick={(e) => { e.stopPropagation(); setCreating(true); }}
                className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500 text-white flex items-center justify-center border-2 border-background"
              >
                <Plus className="h-3 w-3" />
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate w-full text-center">Your story</span>
          </button>
        )}

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
              {profiles[g.user_id]?.full_name ?? "Someone"}
            </span>
          </button>
        ))}
      </div>

      {creating && (
        <StoryCreator pride onClose={() => setCreating(false)} onPosted={() => { setCreating(false); load(); }} />
      )}
      {openAt !== null && groups[openAt] && (
        <StoryViewer
          pride
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

function Ring({ viewed, dim, children }: { viewed: boolean; dim?: boolean; children: React.ReactNode }) {
  return (
    <div className={`h-[62px] w-[62px] rounded-full p-[2px] ${dim ? "bg-border" : viewed ? "bg-border" : "bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500"}`}>
      <div className="h-full w-full rounded-full bg-background p-[2px] flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  );
}
