import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

export type VerifyStatus = "unverified" | "pending" | "verified" | "rejected";

export type MyVerification = {
  status: VerifyStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
};

export const UNVERIFIED: MyVerification = {
  status: "unverified",
  rejection_reason: null,
  submitted_at: null,
};

/** Current member's face-match verification state. */
export async function loadMyVerification(): Promise<MyVerification> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return UNVERIFIED;
  const { data } = await sb
    .from("verification_status")
    .select("status, rejection_reason, submitted_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return UNVERIFIED;
  const raw = (data.status ?? "unverified") as string;
  const status: VerifyStatus =
    raw === "unverified" && data.rejection_reason ? "rejected" : (raw as VerifyStatus);
  return {
    status,
    rejection_reason: data.rejection_reason ?? null,
    submitted_at: data.submitted_at ?? null,
  };
}

/** Upload a freshly captured live selfie and move the member to "pending". */
export async function submitVerification(blob: Blob) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required");
  const path = `${user.id}/verify-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("selfies")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;
  const { error } = await sb.rpc("submit_verification", { _path: path });
  if (error) throw error;
}

export async function signedSelfieUrl(path: string): Promise<string> {
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage.from("selfies").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? "";
}

/** Which of these member ids carry the face-match Verified badge. */
export async function getVerifiedIds(ids: string[]): Promise<Set<string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Set();
  const { data } = await sb.from("profiles").select("id, is_verified").in("id", uniq);
  return new Set((data ?? []).filter((p: any) => p.is_verified).map((p: any) => p.id));
}


export const VERIFY_STATUS_LABEL: Record<VerifyStatus, string> = {
  unverified: "Not verified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};
