// Tiny TTL cache with in-flight de-duplication.
// Purpose: stop the same "doesn't change often" reads (my profile, app settings,
// entitlements, daily icebreaker, weekly challenge, signed photo URLs) from
// re-firing on every navigation and from firing 2-3x concurrently on mount.

type Entry = { value: Promise<any>; exp: number };

const store = new Map<string, Entry>();

/**
 * Returns a cached promise for `key`, or runs `fn` and caches it for `ttlMs`.
 * Concurrent callers during the same tick share one request (de-duplication).
 * Failures are never cached.
 */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.value as Promise<T>;
  const value = fn().catch((e) => {
    store.delete(key);
    throw e;
  });
  store.set(key, { value, exp: now + ttlMs });
  return value;
}

/** Drop one key, or every key beginning with `prefix` when it ends in "*". */
export function invalidate(key: string) {
  if (key.endsWith("*")) {
    const p = key.slice(0, -1);
    for (const k of [...store.keys()]) if (k.startsWith(p)) store.delete(k);
    return;
  }
  store.delete(key);
}

export function invalidateAll() {
  store.clear();
}

export const TTL = {
  /** Session-ish data: profile, entitlements. */
  short: 60_000,
  /** Daily/weekly content and signed URLs. */
  medium: 5 * 60_000,
  /** Signed storage URLs (issued for 1h). */
  signed: 50 * 60_000,
};
