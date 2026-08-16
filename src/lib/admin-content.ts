import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

/* ---------------- Stories moderation (Pride excluded server-side) ---------------- */

export type AdminStory = {
  id: string;
  user_id: string;
  author_name: string | null;
  media_path: string;
  media_type: string;
  text_overlay: string | null;
  created_at: string;
  expires_at: string;
  views: number;
  reports: number;
};

export async function adminListStories(search = ""): Promise<AdminStory[]> {
  const { data, error } = await sb.rpc("admin_list_stories", { _search: search.trim() });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ ...r, views: Number(r.views), reports: Number(r.reports) }));
}

export async function adminDeleteStory(id: string) {
  const { error } = await sb.rpc("admin_delete_story", { _story: id });
  if (error) throw new Error(error.message);
}

/* ---------------- Referrals ---------------- */

export type AdminReferral = {
  referrer_id: string;
  referrer_name: string | null;
  referred_id: string;
  referred_name: string | null;
  signed_up_at: string;
  onboarded: boolean;
  awarded_at: string | null;
};

export async function adminListReferrals(search = ""): Promise<AdminReferral[]> {
  const { data, error } = await sb.rpc("admin_list_referrals", { _search: search.trim() });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminReferral[];
}

export type ReferralLeader = { user_id: string; name: string | null; referrals: number; converted: number };

export async function adminReferralLeaderboard(scope: "month" | "all"): Promise<ReferralLeader[]> {
  const { data, error } = await sb.rpc("admin_referral_leaderboard", { _scope: scope });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ ...r, referrals: Number(r.referrals), converted: Number(r.converted) }));
}

export async function adminReferralStats() {
  const { data, error } = await sb.rpc("admin_referral_stats");
  if (error) throw new Error(error.message);
  const r = (data ?? [])[0] ?? {};
  return {
    total: Number(r.total ?? 0),
    converted: Number(r.converted ?? 0),
    thisMonth: Number(r.this_month ?? 0),
    referrers: Number(r.referrers ?? 0),
  };
}

/* ---------------- Music library ---------------- */

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  category: string;
  license: string;
  attribution: string | null;
  url: string;
  storage_path: string | null;
  active: boolean;
  created_at: string;
};

export async function adminListTracks(): Promise<MusicTrack[]> {
  const { data, error } = await sb.from("music_tracks").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MusicTrack[];
}

/** Uploads an audio file to the private `music` bucket and returns a long-lived signed URL. */
export async function uploadTrackFile(file: File): Promise<{ path: string; url: string }> {
  const ext = file.name.split(".").pop() || "mp3";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("music").upload(path, file, { contentType: file.type || "audio/mpeg" });
  if (error) throw new Error(error.message);
  const { data } = await supabase.storage.from("music").createSignedUrl(path, 60 * 60 * 24 * 365);
  return { path, url: data?.signedUrl ?? "" };
}

export async function adminCreateTrack(t: Partial<MusicTrack>) {
  const { error } = await sb.from("music_tracks").insert({
    title: t.title, artist: t.artist, category: t.category ?? "Other",
    license: t.license ?? "CC BY 4.0", attribution: t.attribution ?? null,
    url: t.url, storage_path: t.storage_path ?? null, active: t.active ?? true,
  });
  if (error) throw new Error(error.message);
}

export async function adminUpdateTrack(id: string, patch: Partial<MusicTrack>) {
  const { error } = await sb.from("music_tracks").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteTrack(id: string, storagePath?: string | null) {
  const { error } = await sb.from("music_tracks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (storagePath) await supabase.storage.from("music").remove([storagePath]).catch?.(() => {});
}
