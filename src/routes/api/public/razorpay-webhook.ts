import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay subscription webhook. Configure this URL in the Razorpay dashboard:
 *   https://<your-domain>/api/public/razorpay-webhook
 * Events handled: subscription.activated, subscription.charged,
 * subscription.completed, subscription.cancelled, subscription.halted,
 * subscription.paused, subscription.resumed.
 */
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
          console.error("RAZORPAY_WEBHOOK_SECRET not configured");
          return new Response("Not configured", { status: 500 });
        }

        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const raw = await request.text();

        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (
          sigBuf.length !== expBuf.length ||
          !timingSafeEqual(sigBuf, expBuf)
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const event = payload?.event as string | undefined;
        const sub = payload?.payload?.subscription?.entity;
        if (!event || !sub?.id) {
          return new Response("ok"); // ignore non-subscription events
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Look up local record to find the user.
        const { data: existing } = await supabaseAdmin
          .from("subscriptions" as any)
          .select("*")
          .eq("razorpay_subscription_id", sub.id)
          .maybeSingle();

        const userId =
          (existing as any)?.user_id ??
          (sub.notes?.user_id as string | undefined) ??
          null;

        const currentStart = sub.current_start
          ? new Date(sub.current_start * 1000).toISOString()
          : null;
        const currentEnd = sub.current_end
          ? new Date(sub.current_end * 1000).toISOString()
          : null;

        const status = sub.status as string;

        // Upsert subscription row.
        if (existing) {
          await supabaseAdmin
            .from("subscriptions" as any)
            .update({
              status,
              current_start: currentStart,
              current_end: currentEnd,
              razorpay_customer_id: sub.customer_id ?? null,
              plan_id: sub.plan_id ?? null,
              cancelled_at:
                status === "cancelled" || status === "completed"
                  ? new Date().toISOString()
                  : (existing as any).cancelled_at,
              raw: sub,
            })
            .eq("razorpay_subscription_id", sub.id);
        } else if (userId) {
          await supabaseAdmin.from("subscriptions" as any).insert({
            user_id: userId,
            razorpay_subscription_id: sub.id,
            razorpay_customer_id: sub.customer_id ?? null,
            plan_id: sub.plan_id ?? null,
            status,
            current_start: currentStart,
            current_end: currentEnd,
            raw: sub,
          });
        }

        // Update the user's profile tier based on event.
        if (userId) {
          const activeStatuses = new Set([
            "authenticated",
            "active",
            "charged",
          ]);
          const endedStatuses = new Set([
            "cancelled",
            "completed",
            "halted",
            "expired",
          ]);

          const isActivating =
            event === "subscription.activated" ||
            event === "subscription.charged" ||
            event === "subscription.resumed" ||
            activeStatuses.has(status);
          const isEnding =
            event === "subscription.cancelled" ||
            event === "subscription.completed" ||
            event === "subscription.halted" ||
            endedStatuses.has(status);

          if (isActivating) {
            await supabaseAdmin
              .from("profiles")
              .update({
                subscription_tier: "premium",
                premium_expires_at: currentEnd,
                razorpay_customer_id: sub.customer_id ?? null,
                razorpay_subscription_id: sub.id,
              })
              .eq("id", userId);
          } else if (isEnding) {
            // Downgrade only after the paid period ends. If we've passed
            // current_end, mark as free now; else leave tier and let the
            // expiry check downgrade access at read time.
            const endedAlready =
              !currentEnd || new Date(currentEnd).getTime() < Date.now();
            if (endedAlready) {
              await supabaseAdmin
                .from("profiles")
                .update({
                  subscription_tier: "free",
                  premium_expires_at: null,
                })
                .eq("id", userId);
            } else {
              await supabaseAdmin
                .from("profiles")
                .update({ premium_expires_at: currentEnd })
                .eq("id", userId);
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
