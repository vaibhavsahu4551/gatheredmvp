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
};

export type VerificationRow = {
  status: "unverified" | "pending" | "verified";
};

export async function loadMe() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: verification }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("verification_status").select("status").eq("user_id", user.id).maybeSingle(),
  ]);
  return { user, profile: profile as ProfileRow | null, verification: verification as VerificationRow | null };
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
