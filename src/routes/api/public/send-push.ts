import { createFileRoute } from "@tanstack/react-router";
import { SignJWT, importPKCS8 } from "jose";

type PushBody = { user_id: string; title: string; body: string; url: string };

async function getAccessToken(sa: { client_email: string; private_key: string }) {
  const key = await importPKCS8(sa.private_key.replace(/\\n/g, "\n"), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!json.access_token) throw new Error(json.error_description ?? "Could not authenticate with FCM");
  return json.access_token;
}

export const Route = createFileRoute("/api/public/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PUSH_HOOK_SECRET;
        if (!secret || request.headers.get("x-push-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: PushBody;
        try {
          payload = (await request.json()) as PushBody;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!payload?.user_id || !payload?.title) return new Response("Bad request", { status: 400 });

        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!raw) return Response.json({ sent: 0, reason: "no_service_account" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows } = await (supabaseAdmin as any)
          .from("push_tokens")
          .select("token, platform")
          .eq("user_id", payload.user_id);
        const devices: { token: string; platform: string }[] = (rows ?? []).map((r: any) => ({
          token: r.token,
          platform: (r.platform ?? "web").toLowerCase(),
        }));
        if (!devices.length) return Response.json({ sent: 0 });

        let sa: { client_email: string; private_key: string; project_id: string };
        try {
          sa = JSON.parse(raw);
        } catch {
          return Response.json({ sent: 0, reason: "bad_service_account" });
        }

        const accessToken = await getAccessToken(sa);
        const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
        const url = payload.url || "/home";
        let sent = 0;
        const dead: string[] = [];

        await Promise.all(
          devices.map(async ({ token, platform }) => {
            const isAndroid = platform === "android";
            const isIos = platform === "ios";
            const isNative = isAndroid || isIos;

            // Native (Capacitor) devices get an OS-level notification through
            // APNs/Android channels; browsers/PWAs get the webpush block.
            const message: Record<string, unknown> = {
              token,
              notification: { title: payload.title, body: payload.body ?? "" },
              data: { url },
            };
            if (isAndroid || !isNative) {
              message['android'] = {
                priority: "HIGH",
                notification: {
                  sound: "default",
                  channel_id: "gathr_default",
                  click_action: "FCM_PLUGIN_ACTIVITY",
                },
              };
            }
            if (isIos || !isNative) {
              message['apns'] = {
                headers: { "apns-priority": "10" },
                payload: { aps: { sound: "default", badge: 1, "content-available": 1 } },
              };
            }
            if (!isNative) {
              message['webpush'] = {
                notification: { icon: "/icon-192.png", badge: "/icon-192.png" },
                fcm_options: { link: url },
              };
            }

            const res = await fetch(endpoint, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ message }),
            });
            if (res.ok) { sent += 1; return; }
            if (res.status === 404 || res.status === 400) dead.push(token);
            console.error("[send-push] FCM error", res.status, platform, await res.text());
          }),
        );


        if (dead.length) {
          await (supabaseAdmin as any).from("push_tokens").delete().in("token", dead);
        }
        return Response.json({ sent });
      },
    },
  },
});
