import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

/** Interest tags usable ONLY inside the Pride identity's profile. */
export const PRIDE_INTERESTS = [
  "Drag shows",
  "Queer book club",
  "LGBTQ+ hiking",
  "Support circle",
  "Pride events & parades",
  "Queer film nights",
  "Ballroom & dance",
  "Activism & allyship",
  "Coffee & chats",
  "Gaming",
  "Dinner parties",
  "Live music",
] as const;

/* ---------------- Guidelines acknowledgement ---------------- */

export async function getPrideGuidelinesAck(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("profiles")
    .select("pride_guidelines_at")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.pride_guidelines_at as string | null) ?? null;
}

export async function acceptPrideGuidelines() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await sb
    .from("profiles")
    .update({ pride_guidelines_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;
}

/* ---------------- Co-host (private-residence Pride events) ---------------- */

export type PrideIdentityLite = { pride_id: string; display_name: string; photo_path: string | null };

export async function searchPrideIdentities(q: string): Promise<PrideIdentityLite[]> {
  const { data, error } = await sb.rpc("pride_search_identities", { _q: q });
  if (error) throw error;
  return (data ?? []) as PrideIdentityLite[];
}

export async function setEventCohost(eventId: string, prideId: string) {
  const { error } = await sb.rpc("pride_set_cohost", { _event: eventId, _pride_id: prideId });
  if (error) throw error;
}

export async function respondCohost(eventId: string, accept: boolean) {
  const { error } = await sb.rpc("pride_respond_cohost", { _event: eventId, _accept: accept });
  if (error) throw error;
}

export type CohostInvite = { event_id: string; title: string; starts_at: string; city: string };

export async function listMyCohostInvites(): Promise<CohostInvite[]> {
  const { data, error } = await sb.rpc("pride_my_cohost_invites");
  if (error) return [];
  return (data ?? []) as CohostInvite[];
}

/* ---------------- Trusted contact check-in ---------------- */

/**
 * Creates a shareable check-in link. The stored/returned payload is deliberately
 * generic (time, city, expected-back time) — never the event title, exact
 * address, Pride flag or any Pride identity.
 */
export async function createCheckinLink(eventId: string, phone: string, hours: number): Promise<string> {
  const { data, error } = await sb.rpc("create_event_checkin", {
    _event: eventId,
    _phone: phone,
    _hours: hours,
  });
  if (error) throw error;
  return `${window.location.origin}/checkin/${data as string}`;
}

export function checkinSmsBody(link: string) {
  return `Hi — I'm attending a social event. Here's when to expect me back: ${link}`;
}
