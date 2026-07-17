import { supabase } from "@/integrations/supabase/client";

export async function listFeed(city: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("city", city)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function signedFeedUrl(path: string) {
  const { data } = await supabase.storage.from("feed-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

export async function createPost(city: string, caption: string, file?: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  let photo_url: string | null = null;
  if (file) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("feed-photos").upload(path, file);
    if (error) throw error;
    photo_url = path;
  }
  const { error } = await supabase.from("posts").insert({ user_id: user.id, city, caption, photo_url });
  if (error) throw error;
}

export async function toggleLike(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { data: existing } = await supabase.from("post_likes")
    .select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (existing) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    return false;
  }
  await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
  return true;
}

export async function getLikes(postIds: string[]) {
  if (!postIds.length) return { counts: {} as Record<string, number>, mine: new Set<string>() };
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds);
  const counts: Record<string, number> = {};
  const mine = new Set<string>();
  for (const l of data ?? []) {
    counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
    if (user && l.user_id === user.id) mine.add(l.post_id);
  }
  return { counts, mine };
}

export async function listComments(postId: string) {
  const { data, error } = await supabase.from("post_comments")
    .select("*").eq("post_id", postId).order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addComment(postId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, body });
  if (error) throw error;
}
