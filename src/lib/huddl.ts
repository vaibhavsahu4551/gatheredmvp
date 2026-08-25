import { supabase } from "@/integrations/supabase/client";
import { cached, invalidate, TTL } from "@/lib/cache";


export const INTERESTS = [
  "Gaming", "Coffee", "Dinner", "Movies",
  "Trekking", "Evening Hangout", "Sports", "Party",
] as const;

export type ProfileRow = {
  id: string;
  full_name: string | null;
  dob: string | null;
  gender: string | null;
  city: string | null;
  bio: string | null;
  interests: string[];
  photos: string[];
  is_verified?: boolean;
  onboarding_complete: boolean;
  pride_opt_in: boolean;
  instagram_handle?: string | null;
  spotify_url?: string | null;
  x_handle?: string | null;
  height_cm?: number | null;
  profession?: string | null;
  smoking?: string | null;
  drinking?: string | null;
};


export type VerificationRow = {
  status: "unverified" | "pending" | "verified";
};

async function loadMeUncached() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Couldn't verify your session: ${userError.message}`);
  if (!user) return null;
  const [profileResult, verificationResult] = await Promise.all([
    (supabase as any).rpc("get_my_profile"),
    supabase.from("verification_status").select("status").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileResult.error) {
    throw new Error(`Couldn't load your profile: ${profileResult.error.message}`);
  }
  const profileRows = profileResult.data;
  const verification = verificationResult.data;
  const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
  return { user, profile: (profile ?? null) as ProfileRow | null, verification: verification as VerificationRow | null };
}

/**
 * My profile + verification state. Cached briefly and de-duplicated, because
 * several components request it on the same mount.
 */
export function loadMe() {
  return cached("me", TTL.short, loadMeUncached);
}

/** Call after editing the profile / verification so the next read is fresh. */
export function invalidateMe() {
  invalidate("me");
}

export function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function signedPhotoUrl(path: string): Promise<string> {
  if (/^https?:\/\//.test(path)) return Promise.resolve(path);
  // Signed URLs last an hour — reuse them instead of re-signing per render.
  return cached(`photo:${path}`, TTL.signed, async () => {
    const { data } = await supabase.storage.from("profile-photos").createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? "";
  });
}

