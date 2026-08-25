import { supabase } from "@/integrations/supabase/client";
import { getMySubscriptionState, type SubscriptionState } from "@/lib/subscription";
import { cached, invalidate, TTL } from "@/lib/cache";

export const FREE_EVENT_CREATE_LIMIT = 3;
export const FREE_EVENT_JOIN_LIMIT = 3;

export type Entitlements = {
  isPremium: boolean;
  hasAccess: boolean; // includes fail-open admin toggle
  subscriptionsEnabled: boolean;
  early_access: boolean;
  state: SubscriptionState;
};

/**
 * Resolve the current user's premium/free entitlements.
 * Cached briefly — many screens ask for this on the same mount.
 */
export function getMyEntitlements(): Promise<Entitlements> {
  return cached("entitlements", TTL.short, async () => {
    const state = await getMySubscriptionState();
    return {
      isPremium: state.tier === "premium",
      hasAccess: state.hasPremiumAccess,
      subscriptionsEnabled: state.subscriptionsEnabled,
      early_access: state.tier === "premium",
      state,
    };
  });
}

/** Call after a purchase/cancel so the next read reflects the new tier. */
export function invalidateEntitlements() {
  invalidate("entitlements");
}


export type LimitCheck = { allowed: boolean; used: number; limit: number };

/** Free users can create at most N events per rolling 30 days. */
export async function canCreateEvent(): Promise<LimitCheck> {
  const ent = await getMyEntitlements();
  if (ent.hasAccess) return { allowed: true, used: 0, limit: Infinity };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, used: 0, limit: FREE_EVENT_CREATE_LIMIT };
  const { data } = await (supabase as any).rpc("count_events_created_last_30d", { _user: user.id });
  const used = typeof data === "number" ? data : 0;
  return { allowed: used < FREE_EVENT_CREATE_LIMIT, used, limit: FREE_EVENT_CREATE_LIMIT };
}

/** Free users can join at most N events per rolling 30 days. */
export async function canJoinEvent(): Promise<LimitCheck> {
  const ent = await getMyEntitlements();
  if (ent.hasAccess) return { allowed: true, used: 0, limit: Infinity };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, used: 0, limit: FREE_EVENT_JOIN_LIMIT };
  const { data } = await (supabase as any).rpc("count_events_joined_last_30d", { _user: user.id });
  const used = typeof data === "number" ? data : 0;
  return { allowed: used < FREE_EVENT_JOIN_LIMIT, used, limit: FREE_EVENT_JOIN_LIMIT };
}

/** Look up subscription tiers for a batch of users. */
export async function getUserTiers(ids: string[]): Promise<Record<string, "free" | "premium">> {
  const out: Record<string, "free" | "premium"> = {};
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return out;
  const { data } = await supabase
    .from("profiles")
    .select("id, subscription_tier, premium_expires_at")
    .in("id", uniq);
  const now = Date.now();
  for (const p of (data ?? []) as any[]) {
    const active =
      p.subscription_tier === "premium" &&
      (!p.premium_expires_at || new Date(p.premium_expires_at).getTime() > now);
    out[p.id] = active ? "premium" : "free";
  }
  for (const id of uniq) if (!out[id]) out[id] = "free";
  return out;
}

/**
 * Can I open a 1:1 DM with this user *without* a mutual Linkup?
 * Free users can DM only after a mutual Linkup (existing behaviour).
 * Premium users can DM anyone (subject to blocks — RLS still applies).
 */
export async function canDmDirect(otherId: string): Promise<boolean> {
  if (!otherId) return false;
  const ent = await getMyEntitlements();
  return ent.hasAccess;
}
