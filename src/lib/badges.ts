import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

export type BadgeDef = {
  badge: string;
  label: string;
  description: string | null;
  icon: string;
  priority: number;
  active: boolean;
};

export type EarnedBadge = { badge: string; reason: string | null; created_at: string };

export async function listBadgeCatalog(): Promise<BadgeDef[]> {
  const { data } = await sb.from("badge_catalog").select("*").eq("active", true).order("priority");
  return (data ?? []) as BadgeDef[];
}

export async function listUserBadges(userId: string): Promise<EarnedBadge[]> {
  const { data } = await sb
    .from("user_badges")
    .select("badge, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EarnedBadge[];
}

/** Members are "New here" for their first 14 days. */
export const NEW_WINDOW_DAYS = 14;
export function isNewHere(createdAt?: string | null) {
  if (!createdAt) return false;
  const age = Date.now() - new Date(createdAt).getTime();
  return age >= 0 && age < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export type FeaturedBadge = { key: string; label: string; kind: "verified" | "premium" | "achievement"; icon?: string };

/**
 * Featured order: Verified > Premium > highest-priority earned achievement
 * (lower `priority` number wins, as configured by admins).
 */
export function featuredBadges(opts: {
  verified?: boolean;
  premium?: boolean;
  earned: EarnedBadge[];
  catalog: BadgeDef[];
}): { featured: FeaturedBadge[]; extra: number } {
  const all: FeaturedBadge[] = [];
  if (opts.verified) all.push({ key: "verified", label: "Verified", kind: "verified" });
  if (opts.premium) all.push({ key: "premium", label: "Premium", kind: "premium" });
  const byName = new Map(opts.catalog.map((c) => [c.badge, c]));
  const achievements = [...opts.earned].sort(
    (a, b) => (byName.get(a.badge)?.priority ?? 999) - (byName.get(b.badge)?.priority ?? 999),
  );
  for (const a of achievements) {
    all.push({
      key: a.badge,
      label: byName.get(a.badge)?.label ?? a.badge,
      kind: "achievement",
      icon: byName.get(a.badge)?.icon ?? "award",
    });
  }
  return { featured: all.slice(0, 3), extra: Math.max(0, all.length - 3) };
}

export async function adminListBadgeCatalog() {
  const { data, error } = await sb.rpc("admin_list_badge_catalog");
  if (error) throw new Error(error.message);
  return (data ?? []) as (BadgeDef & { awarded: number })[];
}

export async function adminUpsertBadge(b: {
  badge: string; label: string; description?: string | null; icon?: string; priority: number; active: boolean;
}) {
  const { error } = await sb.rpc("admin_upsert_badge_catalog", {
    _badge: b.badge, _label: b.label, _description: b.description ?? null,
    _icon: b.icon ?? "award", _priority: b.priority, _active: b.active,
  });
  if (error) throw new Error(error.message);
}
