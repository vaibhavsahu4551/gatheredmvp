import { supabase } from "@/integrations/supabase/client";
import { isRemoteCover, signedEventCoverUrl } from "@/lib/event-cover";
import { getAppSettings } from "@/lib/admin";

export const OFFICIAL_CATEGORIES = [
  "Garba & Dandiya",
  "Music",
  "Concert",
  "Club",
  "Movie",
  "Food & Dining",
  "Gaming",
  "Sports",
  "Meetup",
  "Festival",
  "House Party",
  "College Event",
  "Other",
] as const;

export type OfficialEvent = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  cover_url: string | null;
  starts_at: string;
  ends_at: string | null;
  venue: string;
  city: string;
  price_text: string | null;
  organizer_name: string;
  organizer_logo: string | null;
  booking_whatsapp: string | null;
  ticket_url: string | null;
  terms: string | null;
  pass_price: number | null;
  pass_quantity: number | null;
  pass_info: string | null;
  contact_phone: string | null;
  instructions: string | null;
  is_official: boolean;
  created_by_type: "user" | "admin";
  published: boolean;
  is_featured: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

const T = "official_events" as any;

/** Published official events for the app feed — pinned first, then soonest. */
export async function listPublishedOfficialEvents(opts: { city?: string; limit?: number } = {}) {
  let q = supabase
    .from(T)
    .select("*")
    .eq("published", true)
    .order("is_pinned", { ascending: false })
    .order("is_featured", { ascending: false })
    .order("starts_at", { ascending: true })
    .limit(opts.limit ?? 20);
  if (opts.city) q = q.ilike("city", `%${opts.city}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as OfficialEvent[];
}

/** Human-readable starting price for cards / detail header. */
export function priceLabel(e: Pick<OfficialEvent, "pass_price" | "price_text">) {
  if (e.pass_price != null) return `From ₹${Number(e.pass_price).toLocaleString("en-IN")}`;
  return e.price_text || "";
}

export async function getOfficialEvent(id: string) {
  const { data, error } = await supabase.from(T).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as OfficialEvent | null;
}

/* ---------------- admin ---------------- */

export async function adminListOfficialEvents(q = "") {
  let query = supabase.from(T).select("*").order("is_pinned", { ascending: false }).order("starts_at", { ascending: true });
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OfficialEvent[];
}

export type OfficialStats = { total: number; published: number; draft: number; pinned: number; featured: number };

export function officialStats(rows: OfficialEvent[]): OfficialStats {
  return {
    total: rows.length,
    published: rows.filter((r) => r.published).length,
    draft: rows.filter((r) => !r.published).length,
    pinned: rows.filter((r) => r.is_pinned).length,
    featured: rows.filter((r) => r.is_featured).length,
  };
}

export type OfficialEventInput = Partial<Omit<OfficialEvent, "id" | "created_at" | "updated_at">>;

export async function adminCreateOfficialEvent(input: OfficialEventInput) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(T)
    .insert({ ...input, created_by: user?.id ?? null } as any)
    .select("id")
    .single();
  if (error) throw error;
  return data as unknown as { id: string };
}

export async function adminUpdateOfficialEvent(id: string, patch: OfficialEventInput) {
  const { error } = await supabase.from(T).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function adminDeleteOfficialEvent(id: string) {
  const { error } = await supabase.from(T).delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- media ---------------- */

/** Uploads official-event media (cover / organizer logo) and returns the storage path. */
export async function uploadOfficialMedia(userId: string, file: File) {
  const { compressImage } = await import("@/lib/image-compress");
  const compressed = await compressImage(file, { maxDim: 1600, quality: 0.85 });
  const path = `${userId}/official/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("event-photos")
    .upload(path, compressed, { contentType: compressed.type });
  if (error) throw error;
  return path;
}

/** Resolves a stored value that may be a remote URL or a storage path. */
export async function resolveOfficialMedia(value?: string | null) {
  if (!value) return "";
  if (isRemoteCover(value)) return value;
  return signedEventCoverUrl(value);
}

/* ---------------- whatsapp ---------------- */

export async function defaultBookingWhatsapp(): Promise<string> {
  try {
    const s = (await getAppSettings()) as any;
    return (s?.default_booking_whatsapp as string) ?? "";
  } catch {
    return "";
  }
}

function digits(n: string) {
  const d = (n ?? "").replace(/\D/g, "");
  if (!d) return "";
  // Assume India when no country code was entered.
  return d.length === 10 ? `91${d}` : d;
}

export function bookingMessage(e: OfficialEvent) {
  const when = new Date(e.starts_at).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Hi, I found ${e.title} on Gathr and I'm interested in getting passes.

Event: ${e.title}
Date: ${when}
Venue: ${e.venue}${e.city ? `, ${e.city}` : ""}

Please share the available pass options and booking details.`;
}

/** wa.me link (works on mobile app + desktop web). Empty string when no number configured. */
export function whatsappBookingLink(e: OfficialEvent, fallbackNumber?: string) {
  const num = digits(e.booking_whatsapp || fallbackNumber || "");
  if (!num) return "";
  return `https://wa.me/${num}?text=${encodeURIComponent(bookingMessage(e))}`;
}
