import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsShell } from "@/components/SettingsUI";
import { listBlockedIds } from "@/lib/settings";
import { unblockUser } from "@/lib/safety";
import { getProfilesLite } from "@/lib/events";
import { signedPhotoUrl } from "@/lib/huddl";

export const Route = createFileRoute("/_authenticated/_app/settings/blocked")({
  head: () => ({
    meta: [
      { title: "Blocked users — Gathr" },
      { name: "description", content: "See everyone you've blocked on Gathr and unblock them." },
      { property: "og:title", content: "Blocked users — Gathr" },
      { property: "og:description", content: "See everyone you've blocked on Gathr and unblock them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlockedUsers,
});

function BlockedUsers() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [names, setNames] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});

  const refresh = async () => {
    const list = await listBlockedIds();
    setIds(list);
    if (!list.length) return;
    const profiles = await getProfilesLite(list);
    setNames(profiles);
    const map: Record<string, string> = {};
    await Promise.all(
      Object.entries(profiles).map(async ([uid, p]: any) => {
        if (p?.photo) {
          const url = await signedPhotoUrl(p.photo);
          if (url) map[uid] = url;
        }
      }),
    );
    setPhotos(map);
  };

  useEffect(() => { refresh().catch(() => setIds([])); }, []);

  const unblock = async (uid: string) => {
    try {
      await unblockUser(uid);
      toast.success("Unblocked");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't unblock");
    }
  };

  return (
    <SettingsShell title="Blocked users">
      {ids === null && <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>}
      {ids?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          You haven't blocked anyone.
        </div>
      )}
      <div className="space-y-2">
        {(ids ?? []).map((uid) => {
          const name = names[uid]?.full_name ?? "Member";
          return (
            <div key={uid} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <Link to="/u/$userId" params={{ userId: uid }} className="h-11 w-11 rounded-full overflow-hidden bg-muted shrink-0">
                {photos[uid] ? (
                  <img src={photos[uid]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-brand-soft" />
                )}
              </Link>
              <div className="min-w-0 flex-1 text-[15px] font-medium truncate">{name}</div>
              <button onClick={() => unblock(uid)} className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted transition">
                Unblock
              </button>
            </div>
          );
        })}
      </div>
    </SettingsShell>
  );
}
