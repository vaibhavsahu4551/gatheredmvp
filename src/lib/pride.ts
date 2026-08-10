import { supabase } from "@/integrations/supabase/client";
import { moderatePrideImage } from "./pride-moderate.functions";
import { compressImage } from "./image-compress";

export type PrideProfile = {
  user_id: string;
  pride_id: string;
  display_name: string;
  photo_path: string | null;
  bio: string | null;
  interests?: string[] | null;
};

export type PrideIdentity = {
  pride_id: string;
  display_name: string;
  photo_path: string | null;
  bio: string | null;
  interests?: string[] | null;
};

export async function loadMyPrideProfile(): Promise<PrideProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("pride_profiles" as any)
    .select("user_id, pride_id, display_name, photo_path, bio, interests")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as PrideProfile) ?? null;
}

const identityCache = new Map<string, PrideIdentity>();

export async function getPrideIdentities(prideIds: string[]): Promise<Record<string, PrideIdentity>> {
  const out: Record<string, PrideIdentity> = {};
  const uniq = Array.from(new Set(prideIds.filter(Boolean)));
  const missing: string[] = [];
  for (const id of uniq) {
    const cached = identityCache.get(id);
    if (cached) out[id] = cached;
    else missing.push(id);
  }
  if (missing.length) {
    const { data, error } = await supabase.rpc("get_pride_identities" as any, { _pride_ids: missing });
    if (!error && data) {
      for (const row of data as PrideIdentity[]) {
        identityCache.set(row.pride_id, row);
        out[row.pride_id] = row;
      }
    }
  }
  return out;
}

const photoUrlCache = new Map<string, string>();
export async function signedPridePhotoUrl(path: string): Promise<string> {
  if (!path) return "";
  const cached = photoUrlCache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from("pride-photos").createSignedUrl(path, 60 * 60);
  const url = data?.signedUrl ?? "";
  if (url) photoUrlCache.set(path, url);
  return url;
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Moderates then uploads a Pride photo. Throws with a user-friendly message if blocked. */
export async function moderateAndUploadPridePhoto(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");

  const compressed = await compressImage(file, { maxDim: 720, quality: 0.85 });
  const dataUrl = await fileToDataUrl(compressed);

  const verdict = await moderatePrideImage({ data: { dataUrl } });
  if (!verdict.safe) {
    // Log a strike so repeated violations escalate to suspension.
    await supabase.from("pride_violations" as any).insert({
      user_id: user.id,
      kind: "nsfw_upload_blocked",
      details: verdict.reason?.slice(0, 300) ?? null,
    });
    throw new Error(verdict.reason || "This image was flagged and can't be uploaded.");
  }

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("pride-photos")
    .upload(path, compressed, { upsert: false, contentType: compressed.type });
  if (error) throw error;
  return path;
}

export async function savePrideProfile(patch: {
  display_name: string;
  bio?: string | null;
  photo_path?: string | null;
  interests?: string[] | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const name = patch.display_name.trim();
  if (name.length < 2 || name.length > 40) throw new Error("Display name must be 2–40 characters");
  const bio = (patch.bio ?? "").trim() || null;
  if (bio && bio.length > 200) throw new Error("Bio must be 200 characters or less");

  const { error } = await supabase.from("pride_profiles" as any).upsert(
    {
      user_id: user.id,
      display_name: name,
      bio,
      photo_path: patch.photo_path ?? null,
      ...(patch.interests ? { interests: patch.interests } : {}),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function isPrideSuspended(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc("pride_suspended" as any, { _user: user.id });
  return !!data;
}
