import { createServerFn } from "@tanstack/react-start";

/**
 * Completes the "forgot password" flow: verifies the Firebase phone-auth ID
 * token the browser obtained after a successful OTP check, then sets a new
 * password on the matching Gathr account.
 */
export const resetPasswordWithFirebase = createServerFn({ method: "POST" })
  .inputValidator((input: { idToken: string; password: string }) => {
    if (!input?.idToken) throw new Error("Verification expired — please request a new code");
    if (!input?.password || input.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    return { idToken: input.idToken, password: input.password };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) throw new Error("Phone verification isn't configured yet");

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: data.idToken }),
      },
    );
    const json = (await res.json()) as { users?: Array<{ phoneNumber?: string }> };
    const phoneNumber = json.users?.[0]?.phoneNumber;
    if (!phoneNumber) throw new Error("We couldn't verify that code. Please try again.");

    const digits = phoneNumber.replace(/\D/g, "");
    // Accounts are stored as <digits>@huddl.local; the local number may omit
    // the country code, so try progressively shorter suffixes.
    const candidates = new Set<string>([digits]);
    for (let cut = 1; cut <= 4; cut++) candidates.add(digits.slice(cut));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      if (!list.users.length) break;
      for (const u of list.users) {
        const local = (u.email ?? "").split("@")[0];
        if (local && candidates.has(local)) { userId = u.id; break; }
      }
      if (list.users.length < 200) break;
    }

    if (!userId) throw new Error("No Gathr account is registered with that phone number.");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
    });
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });
