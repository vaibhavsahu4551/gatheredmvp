import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

/* ---------------- types ---------------- */

export type OfficialPass = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  total_quantity: number;
  sold_quantity: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type TicketStatus = "PENDING" | "ACTIVE" | "USED" | "CANCELLED";

export type OfficialOrder = {
  id: string;
  order_code: string;
  user_id: string;
  event_id: string;
  pass_id: string | null;
  pass_name: string;
  quantity: number;
  amount: number;
  utr: string;
  screenshot_path: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  payment_status: PaymentStatus;
  ticket_status: TicketStatus;
  admin_notes: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

const PASSES = "official_event_passes" as any;
const ORDERS = "official_orders" as any;

export function passRemaining(p: OfficialPass) {
  return Math.max(0, p.total_quantity - p.sold_quantity);
}

export function passSoldOut(p: OfficialPass) {
  return p.total_quantity > 0 && passRemaining(p) <= 0;
}

/* ---------------- passes ---------------- */

export async function listPasses(eventId: string, opts: { activeOnly?: boolean } = {}) {
  let q = supabase.from(PASSES).select("*").eq("event_id", eventId).order("sort_order", { ascending: true });
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as OfficialPass[];
}

export type PassInput = Partial<Omit<OfficialPass, "id" | "created_at" | "updated_at" | "sold_quantity">>;

export async function adminCreatePass(eventId: string, input: PassInput) {
  const { error } = await supabase.from(PASSES).insert({ ...input, event_id: eventId } as any);
  if (error) throw error;
}

export async function adminUpdatePass(id: string, patch: PassInput) {
  const { error } = await supabase.from(PASSES).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function adminDeletePass(id: string) {
  const { error } = await supabase.from(PASSES).delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- payment screenshot ---------------- */

/** Uploads a UPI payment screenshot into the private payment-proofs bucket. */
export async function uploadPaymentProof(userId: string, file: File) {
  const compressed = await compressImage(file, { maxDim: 1400, quality: 0.82 });
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(path, compressed, { contentType: compressed.type });
  if (error) throw error;
  return path;
}

/** Signed URL for a payment screenshot (owner or admin only, enforced by storage RLS). */
export async function paymentProofUrl(path?: string | null) {
  if (!path) return "";
  const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 600);
  return data?.signedUrl ?? "";
}

/* ---------------- orders ---------------- */

export type OrderSubmission = {
  eventId: string;
  pass: { id: string | null; name: string; price: number };
  quantity: number;
  utr: string;
  screenshotPath: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
};

/** Creates a PENDING order. Never grants a ticket — admin approval does that. */
export async function submitOrder(s: OrderSubmission) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in to book passes");
  const { data, error } = await supabase
    .from(ORDERS)
    .insert({
      user_id: user.id,
      event_id: s.eventId,
      pass_id: s.pass.id,
      pass_name: s.pass.name,
      quantity: s.quantity,
      amount: Number((s.pass.price * s.quantity).toFixed(2)),
      utr: s.utr.trim(),
      screenshot_path: s.screenshotPath,
      customer_name: s.customerName.trim(),
      customer_phone: s.customerPhone.trim(),
      customer_email: s.customerEmail?.trim() || null,
      payment_status: "PENDING",
      ticket_status: "PENDING",
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as OfficialOrder;
}

export async function myOrders() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from(ORDERS)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OfficialOrder[];
}

export async function myOrdersForEvent(eventId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from(ORDERS)
    .select("*")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OfficialOrder[];
}

/* ---------------- admin orders ---------------- */

export async function adminListOrders(filter: { status?: PaymentStatus | "ALL"; q?: string } = {}) {
  let query = supabase.from(ORDERS).select("*").order("created_at", { ascending: false }).limit(300);
  if (filter.status && filter.status !== "ALL") query = query.eq("payment_status", filter.status);
  if (filter.q?.trim()) query = query.or(`order_code.ilike.%${filter.q.trim()}%,utr.ilike.%${filter.q.trim()}%,customer_phone.ilike.%${filter.q.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OfficialOrder[];
}

export async function adminApproveOrder(id: string, notes?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(ORDERS)
    .update({
      payment_status: "APPROVED",
      ticket_status: "ACTIVE",
      admin_notes: notes?.trim() || null,
      verified_at: new Date().toISOString(),
      verified_by: user?.id ?? null,
    } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function adminRejectOrder(id: string, notes?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(ORDERS)
    .update({
      payment_status: "REJECTED",
      ticket_status: "CANCELLED",
      admin_notes: notes?.trim() || null,
      verified_at: new Date().toISOString(),
      verified_by: user?.id ?? null,
    } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function adminSetTicketStatus(id: string, status: TicketStatus) {
  const { error } = await supabase.from(ORDERS).update({ ticket_status: status } as any).eq("id", id);
  if (error) throw error;
}

/* ---------------- UPI ---------------- */

export function upiPayLink(opts: { upiId: string; payeeName?: string | null; amount: number; note: string }) {
  if (!opts.upiId) return "";
  const p = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName || "Gathr",
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note.slice(0, 40),
  });
  return `upi://pay?${p.toString()}`;
}
