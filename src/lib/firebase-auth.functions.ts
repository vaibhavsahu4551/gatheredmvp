import { createServerFn } from "@tanstack/react-start";

export const getFirebaseConfig = createServerFn({ method: "GET" }).handler(async () => ({
  apiKey: process.env.FIREBASE_API_KEY!,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.FIREBASE_PROJECT_ID!,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.FIREBASE_APP_ID!,
}));

export const bridgeFirebaseAuth = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string }) => {
    if (!d?.idToken || typeof d.idToken !== "string") throw new Error("idToken required");
    return d;
  })
  .handler(async ({ data }) => {
    const { jwtVerify, createRemoteJWKSet } = await import("jose");
    const projectId = process.env.FIREBASE_PROJECT_ID!;
    const JWKS = createRemoteJWKSet(
      new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
    );
    const { payload } = await jwtVerify(data.idToken, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const firebaseUid = payload.sub as string;
    const phone = ((payload as Record<string, unknown>).phone_number as string | undefined) ?? null;
    if (!firebaseUid) throw new Error("Invalid Firebase token");

    const email = `${firebaseUid}@firebase.huddl.local`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing linked profile
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    let userEmail = email;
    let isNew = false;

    if (existing) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(existing.id);
      if (userRes?.user?.email) userEmail = userRes.user.email;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { firebase_uid: firebaseUid, phone },
      });
      if (error || !created?.user) throw new Error(error?.message ?? "Failed to create user");
      // handle_new_user trigger creates a profile row; link Firebase fields to it.
      await supabaseAdmin
        .from("profiles")
        .update({ firebase_uid: firebaseUid, phone })
        .eq("id", created.user.id);
      isNew = true;
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error(linkErr?.message ?? "Failed to generate session");
    }

    return {
      email: userEmail,
      tokenHash: link.properties.hashed_token,
      isNew,
    };
  });
