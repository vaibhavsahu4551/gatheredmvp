import { supabase } from "@/integrations/supabase/client";

export type CheckinState = "VALID" | "USED" | "INVALID" | "UNAUTHORIZED" | "CHECKED_IN";

export type CheckinTicket = {
  state: CheckinState;
  order_id?: string;
  order_code?: string;
  pass_name?: string;
  quantity?: number;
  customer_name?: string;
  ticket_status?: string;
  payment_status?: string;
};

export type CheckinContext =
  | { ok: false; needs_pin?: boolean }
  | {
      ok: true;
      event_id: string;
      title: string;
      venue: string;
      city: string;
      starts_at: string;
    };

/* ---------------- admin ---------------- */

export async function generateCheckinLink(eventId: string, pin?: string) {
  const { data, error } = await supabase.rpc("generate_official_event_checkin_link" as any, {
    p_event_id: eventId,
    p_pin: pin?.trim() || null,
  } as any);
  if (error) throw error;
  return data as unknown as { token: string; url: string; expires_at: string | null; has_pin: boolean };
}

export async function revokeCheckinLinks(eventId: string) {
  const { error } = await supabase.rpc("revoke_official_event_checkin_links" as any, {
    p_event_id: eventId,
  } as any);
  if (error) throw error;
}

/* ---------------- organiser scanner ---------------- */

export async function checkinContext(token: string, pin?: string) {
  const { data, error } = await supabase.rpc("checkin_context" as any, {
    p_token: token,
    p_pin: pin || null,
  } as any);
  if (error) throw error;
  return data as unknown as CheckinContext;
}

export async function lookupTicket(token: string, orderCode: string, pin?: string) {
  const { data, error } = await supabase.rpc("checkin_lookup_ticket" as any, {
    p_token: token,
    p_order_code: orderCode,
    p_pin: pin || null,
  } as any);
  if (error) throw error;
  return data as unknown as CheckinTicket;
}

export async function markTicketUsed(token: string, orderCode: string, pin?: string) {
  const { data, error } = await supabase.rpc("checkin_mark_used" as any, {
    p_token: token,
    p_order_code: orderCode,
    p_pin: pin || null,
  } as any);
  if (error) throw error;
  return data as unknown as CheckinTicket;
}

/** Extracts a ticket order code out of a scanned QR payload. */
export function parseTicketCode(raw: string): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && typeof obj.t === "string") return obj.t.trim().toUpperCase();
  } catch {
    /* not JSON */
  }
  const m = text.match(/GTHR-[A-Z0-9-]+/i);
  if (m) return m[0].toUpperCase();
  return text.toUpperCase();
}
