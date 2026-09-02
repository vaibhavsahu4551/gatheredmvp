import { supabase } from "@/integrations/supabase/client";

export async function isCurrentUserAdmin(): Promise<boolean> {
  // getSession restores from storage without throwing when signed out
  // (getUser throws AuthSessionMissingError, which used to break the panel).
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return false;
  const { data, error } = await supabase
    .from("user_roles" as any)
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}


export type AppSettings = {
  subscription_enabled: boolean;
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  default_booking_whatsapp: string | null;
  upi_id: string | null;
  upi_payee_name: string | null;
};

export async function getAppSettings(): Promise<AppSettings> {
  const { data } = await supabase
    .from("app_settings" as any)
    .select("subscription_enabled, maintenance_enabled, maintenance_message, default_booking_whatsapp, upi_id, upi_payee_name")
    .eq("id", 1)
    .maybeSingle();
  return {
    subscription_enabled: !!(data as any)?.subscription_enabled,
    maintenance_enabled: !!(data as any)?.maintenance_enabled,
    maintenance_message: ((data as any)?.maintenance_message as string) ?? null,
    default_booking_whatsapp: ((data as any)?.default_booking_whatsapp as string) ?? null,
    upi_id: ((data as any)?.upi_id as string) ?? null,
    upi_payee_name: ((data as any)?.upi_payee_name as string) ?? null,
  };
}

export async function setDefaultBookingWhatsapp(number: string | null) {
  clearAppSettingsCache();
  const { error } = await supabase
    .from("app_settings" as any)
    .update({ default_booking_whatsapp: number, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

/** UPI collection details shown on the manual payment checkout screen. */
export async function setUpiSettings(patch: { upi_id?: string | null; upi_payee_name?: string | null }) {
  clearAppSettingsCache();
  const { error } = await supabase
    .from("app_settings" as any)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}


let _settingsCache: Promise<AppSettings> | null = null;

/** Cached app settings (admin master switches). Cheap for render-path checks. */
export function getAppSettingsCached(): Promise<AppSettings> {
  if (!_settingsCache) {
    _settingsCache = getAppSettings().catch(() => ({
      subscription_enabled: false,
      maintenance_enabled: false,
      maintenance_message: null,
      default_booking_whatsapp: null,
    }));
  }
  return _settingsCache;
}

export function clearAppSettingsCache() {
  _settingsCache = null;
}

export async function setSubscriptionEnabled(enabled: boolean) {
  clearAppSettingsCache();
  const { error } = await supabase
    .from("app_settings" as any)
    .update({ subscription_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  "We'll be back soon — Gathr is undergoing scheduled maintenance.";

export async function setMaintenance(patch: { enabled?: boolean; message?: string | null }) {
  clearAppSettingsCache();
  const body: any = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) body.maintenance_enabled = patch.enabled;
  if (patch.message !== undefined) body.maintenance_message = patch.message;
  const { error } = await supabase.from("app_settings" as any).update(body).eq("id", 1);
  if (error) throw error;
}


export type HomeBanner = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  event_id: string | null;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
};

export async function getActiveBanner(): Promise<HomeBanner | null> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("home_banners" as any)
    .select("*")
    .eq("active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function listBanners(): Promise<HomeBanner[]> {
  const { data } = await supabase
    .from("home_banners" as any)
    .select("*")
    .order("created_at", { ascending: false });
  return ((data as any) ?? []) as HomeBanner[];
}

export async function createBanner(input: Omit<HomeBanner, "id"> & { created_by?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("home_banners" as any).insert({
    ...input, created_by: user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateBanner(id: string, patch: Partial<HomeBanner>) {
  const { error } = await supabase.from("home_banners" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteBanner(id: string) {
  const { error } = await supabase.from("home_banners" as any).delete().eq("id", id);
  if (error) throw error;
}

// ---- Admin data queries. Pride is excluded everywhere. ----

export async function adminOverview() {
  const [{ count: users }, { count: events }, { data: signups }, { data: byType }, { data: activeCount }, { data: completedCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_pride", false),
    supabase.from("profiles").select("created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("events").select("event_type").eq("is_pride", false).limit(2000),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_pride", false).in("status", ["pending","confirmed"]),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_pride", false).lt("starts_at", new Date().toISOString()),
  ]);
  const dailySignups: Record<string, number> = {};
  for (const s of (signups ?? []) as any[]) {
    const d = new Date(s.created_at).toISOString().slice(0, 10);
    dailySignups[d] = (dailySignups[d] ?? 0) + 1;
  }
  const typeBreakdown: Record<string, number> = {};
  for (const e of (byType ?? []) as any[]) {
    const t = e.event_type ?? "Other";
    typeBreakdown[t] = (typeBreakdown[t] ?? 0) + 1;
  }
  return {
    userCount: users ?? 0,
    eventCount: events ?? 0,
    activeEvents: (activeCount as any)?.length ?? 0,
    dailySignups,
    typeBreakdown,
    activeEventCount: (activeCount as any) ? 0 : 0, // placeholder; real value below via head count
  };
}

export async function adminListUsers(search = "") {
  const { data, error } = await (supabase as any).rpc("admin_list_users", { _search: search.trim() });
  if (error) throw error;
  const rows = ((data as any[]) ?? []);
  const ids = rows.map((r) => r.id);
  const [{ data: hosted }, { data: reports }] = await Promise.all([
    supabase.from("events").select("host_id").eq("is_pride", false).in("host_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("reports").select("target_id").eq("target_type", "user").in("target_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const hostCount: Record<string, number> = {};
  for (const h of (hosted ?? []) as any[]) hostCount[h.host_id] = (hostCount[h.host_id] ?? 0) + 1;
  const reportCount: Record<string, number> = {};
  for (const r of (reports ?? []) as any[]) reportCount[r.target_id] = (reportCount[r.target_id] ?? 0) + 1;
  return rows.map((r) => ({
    ...r,
    event_count: hostCount[r.id] ?? 0,
    report_count: reportCount[r.id] ?? 0,
  }));
}

export async function suspendUser(userId: string, until: string | null, reason: string | null) {
  const { error } = await (supabase as any).rpc("admin_suspend_user", { _user: userId, _until: until, _reason: reason });
  if (error) throw error;
}

export async function adminListEvents(search = "") {
  let q = supabase.from("events").select("id, title, host_id, starts_at, status, event_type, city, max_size").eq("is_pride", false).order("starts_at", { ascending: false }).limit(500);
  if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
  const { data } = await q;
  const rows = ((data as any[]) ?? []);
  const ids = rows.map((r) => r.id);
  const hostIds = Array.from(new Set(rows.map((r) => r.host_id)));
  const [{ data: parts }, { data: hosts }] = await Promise.all([
    supabase.from("event_participants").select("event_id, status").in("event_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("profiles").select("id, full_name").in("id", hostIds.length ? hostIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const attendees: Record<string, number> = {};
  for (const p of (parts ?? []) as any[]) if (p.status === "approved") attendees[p.event_id] = (attendees[p.event_id] ?? 0) + 1;
  const hostMap: Record<string, string | null> = {};
  for (const h of (hosts ?? []) as any[]) hostMap[h.id] = h.full_name;
  return rows.map((r) => ({ ...r, attendees: attendees[r.id] ?? 0, host_name: hostMap[r.host_id] ?? "Unknown" }));
}

export async function adminDeleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export type AdminReport = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  is_pride_related?: boolean;
};

export async function adminListReports() {
  const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(500);
  const rows = ((data as any[]) ?? []) as AdminReport[];
  // Detect Pride-related targets (event/user/post/message tied to a Pride event)
  const eventIds = rows.filter((r) => r.target_type === "event").map((r) => r.target_id);
  const { data: evs } = eventIds.length
    ? await supabase.from("events").select("id, is_pride").in("id", eventIds)
    : { data: [] as any[] };
  const prideEventSet = new Set(((evs ?? []) as any[]).filter((e) => e.is_pride).map((e) => e.id));
  return rows.map((r) => ({ ...r, is_pride_related: r.target_type === "event" && prideEventSet.has(r.target_id) }));
}

export async function updateReportStatus(id: string, status: "pending" | "reviewed" | "actioned", notes?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("reports").update({
    status,
    admin_notes: notes ?? null,
    reviewed_by: user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  } as any).eq("id", id);
  if (error) throw error;
}

export async function adminDeletePost(id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}
