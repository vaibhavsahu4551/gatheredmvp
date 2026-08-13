import type { EventRow } from "@/lib/events";

export type EventPhase = "open" | "filling" | "closed";

type AnyEvent = EventRow & { closed_at?: string | null };

export function isEventClosed(e: AnyEvent): boolean {
  if ((e as any).closed_at) return true;
  if (e.status === "cancelled" || e.status === "completed") return true;
  return new Date(e.starts_at).getTime() < Date.now();
}

/** Near-capacity threshold: full, or within one seat / 75% of max. */
export function eventPhase(e: AnyEvent, total = 0): EventPhase {
  if (isEventClosed(e)) return "closed";
  const max = e.max_size ?? 0;
  if (max > 0) {
    const threshold = Math.max(e.min_size ?? 0, Math.ceil(max * 0.75), max - 1);
    if (total >= threshold) return "filling";
  }
  return "open";
}

export function phaseLabel(p: EventPhase) {
  return p === "closed" ? "Closed" : p === "filling" ? "Filling up" : "Open";
}

const RANK: Record<EventPhase, number> = { open: 0, filling: 1, closed: 2 };

function recencyKey(e: AnyEvent, p: EventPhase) {
  if (p === "closed") {
    // Most recently closed first: explicit close time, else the time it ended.
    return new Date((e as any).closed_at ?? e.starts_at).getTime();
  }
  return new Date(e.created_at ?? e.starts_at).getTime();
}

/** Open (newest first) → Filling up (newest first) → Closed (most recently closed first). */
export function sortEventsByStatus<T extends AnyEvent>(
  events: T[],
  counts?: Record<string, { total: number }>,
): T[] {
  return [...events].sort((a, b) => {
    const pa = eventPhase(a, counts?.[a.id]?.total ?? 0);
    const pb = eventPhase(b, counts?.[b.id]?.total ?? 0);
    if (RANK[pa] !== RANK[pb]) return RANK[pa] - RANK[pb];
    return recencyKey(b, pb) - recencyKey(a, pa);
  });
}
