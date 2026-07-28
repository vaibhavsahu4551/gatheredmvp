import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

export const MAX_VOICE_MS = 60_000;

export async function uploadVoiceNote(blob: Blob): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("voice-notes").upload(path, blob, {
    contentType: blob.type || "audio/webm",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

const cache = new Map<string, { url: string; exp: number }>();
export async function signedVoiceUrl(path: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now) return hit.url;
  const { data } = await supabase.storage.from("voice-notes").createSignedUrl(path, 3600);
  const url = data?.signedUrl ?? "";
  if (url) cache.set(path, { url, exp: now + 55 * 60 * 1000 });
  return url;
}

export async function sendDmVoice(threadId: string, path: string, durationMs: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await sb.from("dm_messages").insert({
    thread_id: threadId, sender_id: user.id,
    voice_url: path, voice_duration_ms: durationMs,
  });
  if (error) throw error;
  await sb.from("dm_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
}

export async function sendGroupVoice(groupId: string, path: string, durationMs: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await sb.from("chat_messages").insert({
    group_id: groupId, user_id: user.id,
    voice_url: path, voice_duration_ms: durationMs,
  });
  if (error) throw error;
}
