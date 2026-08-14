import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

const sb: any = supabase;

export type Circle = {
  id: string;
  name: string;
  description: string | null;
  photo_path: string | null;
  created_by: string;
  invite_code: string;
  created_at: string;
};

export type CircleWithMeta = Circle & { member_count: number; group_id: string | null };

export async function listMyCircles(): Promise<CircleWithMeta[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: mine, error } = await sb
    .from("circle_members")
    .select("circle_id, circles(*)")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  const circles = (mine ?? []).map((r: any) => r.circles).filter(Boolean) as Circle[];
  if (!circles.length) return [];
  const ids = circles.map((c) => c.id);
  const [{ data: members }, { data: groups }] = await Promise.all([
    sb.from("circle_members").select("circle_id").in("circle_id", ids),
    sb.from("chat_groups").select("id, circle_id").in("circle_id", ids),
  ]);
  const counts: Record<string, number> = {};
  for (const m of members ?? []) counts[m.circle_id] = (counts[m.circle_id] ?? 0) + 1;
  const gmap: Record<string, string> = {};
  for (const g of groups ?? []) if (g.circle_id) gmap[g.circle_id] = g.id;
  return circles
    .map((c) => ({ ...c, member_count: counts[c.id] ?? 1, group_id: gmap[c.id] ?? null }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getCircle(id: string): Promise<CircleWithMeta | null> {
  const { data } = await sb.from("circles").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [{ data: members }, { data: group }] = await Promise.all([
    sb.from("circle_members").select("user_id").eq("circle_id", id),
    sb.from("chat_groups").select("id").eq("circle_id", id).maybeSingle(),
  ]);
  return { ...(data as Circle), member_count: (members ?? []).length, group_id: group?.id ?? null };
}

export async function listCircleMemberIds(circleId: string): Promise<string[]> {
  const { data } = await sb.from("circle_members").select("user_id").eq("circle_id", circleId);
  return (data ?? []).map((r: any) => r.user_id as string);
}

export async function uploadCirclePhoto(userId: string, file: File) {
  const compressed = await compressImage(file, { maxDim: 800, quality: 0.82 });
  const path = `${userId}/circle-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("event-photos")
    .upload(path, compressed, { contentType: compressed.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedCirclePhotoUrl(path: string) {
  const { data } = await supabase.storage.from("event-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

export async function createCircle(input: { name: string; description?: string; photo?: File | null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  let photo_path: string | null = null;
  if (input.photo) photo_path = await uploadCirclePhoto(user.id, input.photo);
  const { data, error } = await sb
    .from("circles")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      photo_path,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string;
}

export async function addCircleMembers(circleId: string, userIds: string[]) {
  if (!userIds.length) return;
  const { error } = await sb
    .from("circle_members")
    .upsert(userIds.map((user_id) => ({ circle_id: circleId, user_id })), { onConflict: "circle_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function removeCircleMember(circleId: string, userId: string) {
  const { error } = await sb.from("circle_members").delete().eq("circle_id", circleId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteCircle(circleId: string) {
  const { error } = await sb.from("circles").delete().eq("id", circleId);
  if (error) throw new Error(error.message);
}

export async function joinCircleByCode(code: string): Promise<string> {
  const { data, error } = await sb.rpc("join_circle_by_code", { _code: code });
  if (error) throw new Error(error.message);
  return data as string;
}

export function circleInviteLink(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://gatheredmvp.lovable.app";
  return `${origin}/circles/join/${code}`;
}

/** Drops a short note into the circle's group chat (used when an event is created for a circle). */
export async function postToCircleChat(circleId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: g } = await sb.from("chat_groups").select("id").eq("circle_id", circleId).maybeSingle();
  if (!g?.id) return;
  await sb.from("chat_messages").insert({ group_id: g.id, user_id: user.id, body });
}
