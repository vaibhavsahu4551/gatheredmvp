import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type ParticipantRow = Database["public"]["Tables"]["event_participants"]["Row"];
export const CATEGORIES = ["Gaming","Coffee","Dinner","Movie","Hangout","Sports","Party"] as const;
export type Category = typeof CATEGORIES[number];

export const EVENT_TYPES = ["Breakfast","Lunch","Dinner","Drinks","Club","Gaming","Movies","Trek","Other"] as const;
export type EventType = typeof EVENT_TYPES[number];

const RESIDENTIAL_HINTS = ["apartment","apartments","flat ","flat,","villa","house no","house #","road no","block ","layout"];
export function looksResidential(addr: string): boolean {
  const a = addr.toLowerCase();
  return RESIDENTIAL_HINTS.some((h) => a.includes(h));
}

export async function listEvents(city: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("city", city)
    .in("status", ["pending","confirmed"])
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listHostedEvents(userId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("host_id", userId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listJoinedEvents(userId: string) {
  const { data, error } = await supabase
    .from("event_participants")
    .select("event_id, status, events(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.events as EventRow)
    .filter((e): e is EventRow => !!e)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
}


export async function getEvent(id: string) {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getParticipants(eventId: string) {
  const { data, error } = await supabase.from("event_participants").select("*").eq("event_id", eventId);
  if (error) throw error;
  return data ?? [];
}

export async function getProfilesLite(ids: string[]) {
  if (!ids.length) return {};
  const { data, error } = await supabase.from("profiles").select("id, full_name, gender").in("id", ids);
  if (error) throw error;
  const map: Record<string, { full_name: string | null; gender: string | null }> = {};
  for (const p of data ?? []) map[p.id] = { full_name: p.full_name, gender: p.gender };
  return map;
}

export function countByGender(participants: ParticipantRow[]) {
  let boys = 0, girls = 0, other = 0;
  for (const p of participants) {
    if (p.status !== "approved") continue;
    const g = (p.gender ?? "").toLowerCase();
    if (g === "man") boys++;
    else if (g === "woman") girls++;
    else other++;
  }
  return { boys, girls, other, total: boys + girls + other };
}

export async function requestJoin(eventId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { data: prof } = await supabase.from("profiles").select("gender").eq("id", user.id).maybeSingle();
  const { error } = await supabase.from("event_participants").insert({
    event_id: eventId, user_id: user.id, gender: prof?.gender ?? null,
  });
  if (error) throw error;
}

export async function setParticipantStatus(id: string, status: "approved" | "rejected") {
  const { error } = await supabase.from("event_participants").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function myParticipation(eventId: string, userId: string) {
  const { data } = await supabase.from("event_participants")
    .select("*").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  return data;
}

export type EventComment = {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export async function listEventComments(eventId: string): Promise<EventComment[]> {
  const { data, error } = await supabase
    .from("event_comments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as EventComment[];
}

export async function postEventComment(eventId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Empty message");
  const { error } = await supabase.from("event_comments").insert({
    event_id: eventId, user_id: user.id, body: trimmed,
  });
  if (error) throw error;
}
