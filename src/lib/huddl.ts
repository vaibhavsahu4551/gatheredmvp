import { supabase } from "@/integrations/supabase/client";

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
  selfie_url: string | null;
  onboarding_complete: boolean;
  pride_opt_in: boolean;
  instagram_handle?: string | null;
  spotify_url?: string | null;
  x_handle?: string | null;
};


export type VerificationRow = {
  status: "unverified" | "pending" | "verified";
};

export async function loadMe() {
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

export function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export async function signedPhotoUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from("profile-photos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}
