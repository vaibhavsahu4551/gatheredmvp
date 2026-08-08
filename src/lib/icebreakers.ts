import { supabase } from "@/integrations/supabase/client";

export type TodayIcebreaker = {
  day: string;
  prompt_id: string;
  prompt: string;
  answer_count: number;
  my_post_id: string | null;
};

export async function getTodayIcebreaker(): Promise<TodayIcebreaker | null> {
  const { data, error } = await supabase.rpc("get_today_icebreaker" as any);
  if (error) throw error;
  const row = (data as any[])?.[0];
  return row ? (row as TodayIcebreaker) : null;
}

/** Posts an icebreaker answer as a normal post (likes/comments work as usual). */
export async function answerIcebreaker(promptId: string, day: string, body: string, city: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const text = body.trim();
  if (!text) throw new Error("Write an answer first");
  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    city: city || "",
    caption: text,
    kind: "icebreaker",
    icebreaker_day: day,
    prompt_id: promptId,
  } as any);
  if (error) throw error;
}

export async function listIcebreakerAnswers(day: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("id, user_id, caption, photo_url, event_id, created_at, prompt_id")
    .eq("kind", "icebreaker")
    .eq("icebreaker_day", day)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getPromptsLite(ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  const map: Record<string, string> = {};
  if (!uniq.length) return map;
  const { data } = await supabase.from("icebreaker_prompts").select("id, body").in("id", uniq);
  for (const p of (data ?? []) as any[]) map[p.id] = p.body;
  return map;
}
