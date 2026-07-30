import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

const sb: any = supabase;

export type LinkupPrivacy = "everyone" | "no_one";

export type UserSettings = {
  user_id: string;
  push_enabled: boolean;
  notify_likes: boolean;
  notify_comments: boolean;
  notify_join_requests: boolean;
  notify_messages: boolean;
  notify_linkups: boolean;
  linkup_privacy: LinkupPrivacy;
  deactivated_at: string | null;
};

export const DEFAULT_SETTINGS: Omit<UserSettings, "user_id"> = {
  push_enabled: true,
  notify_likes: true,
  notify_comments: true,
  notify_join_requests: true,
  notify_messages: true,
  notify_linkups: true,
  linkup_privacy: "everyone",
  deactivated_at: null,
};

export async function loadSettings(): Promise<UserSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { data, error } = await sb
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return { user_id: user.id, ...DEFAULT_SETTINGS, ...(data ?? {}) } as UserSettings;
}

export async function saveSettings(patch: Partial<Omit<UserSettings, "user_id">>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await sb
    .from("user_settings")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Blocked users (ids) for the signed-in member. */
export async function listBlockedIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await sb
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => r.blocked_id);
}

export async function setPrideOptIn(value: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const { error } = await supabase
    .from("profiles")
    .update({ pride_opt_in: value } as any)
    .eq("id", user.id);
  if (error) throw error;
}

export async function submitSupportTicket(description: string, file?: File | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const body = description.trim();
  if (body.length < 10) throw new Error("Please describe the problem (at least 10 characters)");
  if (body.length > 2000) throw new Error("Please keep it under 2000 characters");

  let screenshot_path: string | null = null;
  if (file) {
    const compressed = await compressImage(file, { maxDim: 1280, quality: 0.8 });
    const path = `${user.id}/support-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("feed-photos")
      .upload(path, compressed, { contentType: compressed.type });
    if (error) throw error;
    screenshot_path = path;
  }

  const { error } = await sb.from("support_tickets").insert({
    user_id: user.id,
    description: body,
    screenshot_path,
  });
  if (error) throw error;
}

export const SUPPORT_EMAIL = "gathrmeet1921@gmail.com";
