import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getTodayIcebreaker, listIcebreakerAnswers, type TodayIcebreaker } from "@/lib/icebreakers";
import { getProfilesLite } from "@/lib/events";
import { getLikes, toggleLike } from "@/lib/feed";
import { loadBlockedIds } from "@/lib/safety";
import { PostCard, type PostItem } from "@/components/PostCard";
import { IcebreakerCard } from "@/components/IcebreakerCard";

export const Route = createFileRoute("/_authenticated/_app/icebreaker")({
  component: IcebreakerPage,
  head: () => ({
    meta: [
      { title: "Daily Icebreaker · Gathr" },
      { name: "description", content: "Answer today's Gathr icebreaker and see what everyone else said." },
      { property: "og:title", content: "Daily Icebreaker · Gathr" },
      { property: "og:description", content: "One fun prompt a day for the whole Gathr community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function IcebreakerPage() {
  const [ib, setIb] = useState<TodayIcebreaker | null>(null);
  const [items, setItems] = useState<PostItem[]>([]);
  const [names, setNames] = useState<Record<string, { full_name: string | null; photo: string | null }>>({});
  const [likes, setLikes] = useState<{ counts: Record<string, number>; mine: Set<string> }>({ counts: {}, mine: new Set() });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = await getTodayIcebreaker();
      setIb(today);
      if (!today) return;
      const [rows, blocked] = await Promise.all([listIcebreakerAnswers(today.day), loadBlockedIds()]);
      const posts: PostItem[] = (rows as any[])
        .filter((p) => !blocked.has(p.user_id))
        .map((p) => ({
          kind: "post", id: p.id, created_at: p.created_at, user_id: p.user_id,
          caption: p.caption, photo_url: p.photo_url, event_id: p.event_id ?? null,
        }));
      setItems(posts);
      const [n, l] = await Promise.all([
        getProfilesLite(posts.map((p) => p.user_id)),
        getLikes(posts.map((p) => p.id)),
      ]);
      setNames(n as any);
      setLikes(l);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onLike = async (id: string) => {
    setLikes((prev) => {
      const mine = new Set(prev.mine);
      const counts = { ...prev.counts };
      if (mine.has(id)) { mine.delete(id); counts[id] = Math.max(0, (counts[id] ?? 1) - 1); }
      else { mine.add(id); counts[id] = (counts[id] ?? 0) + 1; }
      return { counts, mine };
    });
    try { await toggleLike(id); } catch { /* ignore */ }
  };

  return (
    <div className="pb-6">
      <header className="px-5 pt-8 pb-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gradient-brand">
          <Sparkles className="h-3.5 w-3.5" /> Daily icebreaker
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{ib?.prompt ?? "Today's prompt"}</h1>
      </header>
      <div className="px-5 space-y-3">
        <IcebreakerCard onAnswered={load} />
        {loading && <div className="text-sm text-muted-foreground py-6 text-center">Loading answers…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-muted-foreground py-10 text-center">No answers yet — be the first.</div>
        )}
        {items.map((p) => (
          <PostCard
            key={p.id}
            p={p}
            name={names[p.user_id]?.full_name ?? "Someone"}
            avatarPhoto={names[p.user_id]?.photo ?? null}
            liked={likes.mine.has(p.id)}
            likeCount={likes.counts[p.id] ?? 0}
            onLike={() => onLike(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
