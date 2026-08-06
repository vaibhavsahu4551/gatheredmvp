import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

const sb: any = supabase;

export const STORY_MAX_VIDEO_MS = 30_000;
export const STORY_PHOTO_MS = 5_000;

export type StoryRow = {
  id: string;
  user_id: string;
  media_path: string;
  media_type: "photo" | "video";
  text_overlay: string | null;
  event_id: string | null;
  music_title: string | null;
  music_artist: string | null;
  music_url: string | null;
  music_start_ms: number;
  music_end_ms: number;
  music_attribution: string | null;
  created_at: string;
  expires_at: string;
};

export type StoryGroup = {
  user_id: string;
  stories: StoryRow[];
  allViewed: boolean;
};

const urlCache = new Map<string, { url: string; exp: number }>();

export async function signedStoryUrl(path: string): Promise<string> {
  const now = Date.now();
  const hit = urlCache.get(path);
  if (hit && hit.exp > now) return hit.url;
  const { data } = await supabase.storage.from("stories").createSignedUrl(path, 3600);
  const url = data?.signedUrl ?? "";
  if (url) urlCache.set(path, { url, exp: now + 55 * 60 * 1000 });
  return url;
}

/** Active (non-expired) stories, grouped per user and ordered for the rail. */
export async function listActiveStories(): Promise<{ groups: StoryGroup[]; meId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  const meId = user?.id ?? "";
  const { data, error } = await sb
    .from("stories")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  const rows = (data ?? []) as StoryRow[];

  let viewed = new Set<string>();
  if (meId && rows.length) {
    const { data: v } = await sb
      .from("story_views")
      .select("story_id")
      .eq("viewer_id", meId)
      .in("story_id", rows.map((r) => r.id));
    viewed = new Set((v ?? []).map((x: any) => x.story_id as string));
  }

  const byUser = new Map<string, StoryRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  const groups: StoryGroup[] = [...byUser.entries()].map(([user_id, stories]) => ({
    user_id,
    stories,
    allViewed: stories.every((s) => viewed.has(s.id)),
  }));

  return { groups, meId };
}

/** Ordering: me first, then Linkups, then everyone else; unviewed before viewed. */
export function orderGroups(groups: StoryGroup[], meId: string, connections: Set<string>) {
  const rank = (g: StoryGroup) =>
    g.user_id === meId ? 0 : connections.has(g.user_id) ? 1 : 2;
  return [...groups].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
    const at = a.stories[a.stories.length - 1]?.created_at ?? "";
    const bt = b.stories[b.stories.length - 1]?.created_at ?? "";
    return bt.localeCompare(at);
  });
}

export async function createStory(input: {
  file: File;
  mediaType: "photo" | "video";
  text?: string | null;
  eventId?: string | null;
  music?: { title: string; artist: string; url: string; startMs: number; endMs: number; attribution: string } | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");

  let upload: Blob = input.file;
  let ext = "jpg";
  if (input.mediaType === "photo") {
    upload = await compressImage(input.file, { maxDim: 1440, quality: 0.85 });
  } else {
    ext = input.file.type.includes("quicktime") ? "mov" : input.file.type.includes("webm") ? "webm" : "mp4";
  }
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("stories").upload(path, upload, {
    contentType: (upload as File).type || (input.mediaType === "photo" ? "image/jpeg" : "video/mp4"),
  });
  if (upErr) throw upErr;

  const { error } = await sb.from("stories").insert({
    user_id: user.id,
    media_path: path,
    media_type: input.mediaType,
    text_overlay: input.text?.trim() || null,
    event_id: input.eventId ?? null,
    music_title: input.music?.title ?? null,
    music_artist: input.music?.artist ?? null,
    music_url: input.music?.url ?? null,
    music_start_ms: input.music?.startMs ?? 0,
    music_end_ms: input.music?.endMs ?? 15000,
    music_attribution: input.music?.attribution ?? null,
  });
  if (error) throw error;
}

export async function deleteStory(id: string, mediaPath?: string) {
  const { error } = await sb.from("stories").delete().eq("id", id);
  if (error) throw error;
  if (mediaPath) await supabase.storage.from("stories").remove([mediaPath]).catch?.(() => {});
}

export async function markStoryViewed(storyId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await sb.from("story_views").upsert(
    { story_id: storyId, viewer_id: user.id },
    { onConflict: "story_id,viewer_id", ignoreDuplicates: true },
  );
}

export async function listStoryViewers(storyId: string) {
  const { data } = await sb
    .from("story_views")
    .select("viewer_id, created_at")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false });
  return (data ?? []) as { viewer_id: string; created_at: string }[];
}
