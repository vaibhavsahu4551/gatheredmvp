import { supabase } from "@/integrations/supabase/client";
import { loadBlockedIds } from "@/lib/safety";

export type Suggestion = {
  id: string;
  full_name: string | null;
  city: string | null;
  photo: string | null;
  interests: string[];
  mutuals: number;
  sharedInterests: string[];
  sameCity: boolean;
  coEvents: number;
  score: number;
};

const CACHE_KEY = "gathr_people_suggestions_v1";
const TTL_MS = 24 * 60 * 60 * 1000;

type Cache = { at: number; me: string; items: Suggestion[] };

function readCache(meId: string): Suggestion[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache;
    if (c.me !== meId || Date.now() - c.at > TTL_MS) return null;
    return c.items;
  } catch {
    return null;
  }
}

function writeCache(meId: string, items: Suggestion[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), me: meId, items } satisfies Cache));
  } catch { /* ignore quota */ }
}

export function invalidateSuggestionsCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

const sb: any = supabase;

async function computeSuggestions(meId: string): Promise<Suggestion[]> {
  const { data: myRows } = await sb.rpc("get_my_profile");
  const me = Array.isArray(myRows) ? myRows[0] : myRows;
  const myInterests: string[] = me?.interests ?? [];
  const myCity: string | null = me?.city ?? null;
  const viewerPride = !!me?.pride_opt_in;

  // Exclusions
  const [blocked, { data: reqs }, { data: dismissed }] = await Promise.all([
    loadBlockedIds(),
    sb.from("huddle_requests").select("from_id, to_id, status").or(`from_id.eq.${meId},to_id.eq.${meId}`),
    sb.from("suggestion_dismissals").select("dismissed_id").eq("user_id", meId),
  ]);

  const exclude = new Set<string>([meId]);
  blocked.forEach((id) => exclude.add(id));
  (dismissed ?? []).forEach((d: any) => exclude.add(d.dismissed_id));

  const myConnections = new Set<string>();
  for (const r of (reqs ?? []) as any[]) {
    const other = r.from_id === meId ? r.to_id : r.from_id;
    if (r.status === "accepted") myConnections.add(other);
    exclude.add(other); // connected, pending or declined — don't suggest
  }

  // Mutual connections: everyone my connections are linked with
  const mutualCount: Record<string, number> = {};
  if (myConnections.size) {
    const ids = Array.from(myConnections);
    const { data: theirs } = await sb
      .from("huddle_requests")
      .select("from_id, to_id, status")
      .eq("status", "accepted")
      .or(`from_id.in.(${ids.join(",")}),to_id.in.(${ids.join(",")})`);
    for (const r of (theirs ?? []) as any[]) {
      for (const side of [r.from_id, r.to_id] as string[]) {
        if (myConnections.has(side)) continue;
        mutualCount[side] = (mutualCount[side] ?? 0) + 1;
      }
    }
  }

  // Co-attendees of events I joined (non-Pride only)
  const coEvents: Record<string, number> = {};
  const { data: mine } = await sb
    .from("event_participants")
    .select("event_id")
    .eq("user_id", meId)
    .eq("status", "approved")
    .limit(100);
  const eventIds = Array.from(new Set(((mine ?? []) as any[]).map((r) => r.event_id)));
  if (eventIds.length) {
    const { data: others } = await sb
      .from("event_participants")
      .select("user_id")
      .in("event_id", eventIds)
      .eq("status", "approved");
    for (const r of (others ?? []) as any[]) {
      if (r.user_id === meId) continue;
      coEvents[r.user_id] = (coEvents[r.user_id] ?? 0) + 1;
    }
  }

  // Candidate pool: mutuals + co-attendees + same city + shared interests
  const seeded = Array.from(new Set([...Object.keys(mutualCount), ...Object.keys(coEvents)])).filter((id) => !exclude.has(id));

  const cols = "id, full_name, city, photos, interests, pride_opt_in, onboarding_complete";
  const queries: Promise<any>[] = [];
  if (seeded.length) queries.push(sb.from("profiles").select(cols).in("id", seeded.slice(0, 200)));
  if (myCity) queries.push(sb.from("profiles").select(cols).eq("onboarding_complete", true).eq("city", myCity).neq("id", meId).limit(100));
  if (myInterests.length) queries.push(sb.from("profiles").select(cols).eq("onboarding_complete", true).overlaps("interests", myInterests).neq("id", meId).limit(100));
  const results = await Promise.all(queries);

  const byId: Record<string, any> = {};
  for (const r of results) for (const p of (r?.data ?? []) as any[]) byId[p.id] = p;

  const mineSet = new Set(myInterests);
  const items: Suggestion[] = Object.values(byId)
    .filter((p: any) => !exclude.has(p.id) && p.onboarding_complete)
    .filter((p: any) => (viewerPride ? true : !p.pride_opt_in))
    .map((p: any): Suggestion => {
      const shared = (p.interests ?? []).filter((i: string) => mineSet.has(i));
      const mutuals = mutualCount[p.id] ?? 0;
      const sameCity = !!myCity && p.city === myCity;
      const co = coEvents[p.id] ?? 0;
      return {
        id: p.id,
        full_name: p.full_name ?? null,
        city: p.city ?? null,
        photo: p.photos?.[0] ?? null,
        interests: p.interests ?? [],
        mutuals,
        sharedInterests: shared,
        sameCity,
        coEvents: co,
        score: mutuals * 5 + co * 3 + shared.length * 2 + (sameCity ? 1 : 0),
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  return items;
}

export async function getSuggestions(opts?: { force?: boolean }): Promise<Suggestion[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  if (!opts?.force) {
    const cached = readCache(user.id);
    if (cached) return cached;
  }
  const items = await computeSuggestions(user.id);
  writeCache(user.id, items);
  return items;
}

export async function dismissSuggestion(userId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await sb.from("suggestion_dismissals").insert({ user_id: user.id, dismissed_id: userId });
  const cached = readCache(user.id);
  if (cached) writeCache(user.id, cached.filter((s) => s.id !== userId));
}
