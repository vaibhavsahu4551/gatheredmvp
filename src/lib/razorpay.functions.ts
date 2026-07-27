import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creates a Razorpay subscription for the current user and returns the ids
 * the browser needs to open Razorpay Checkout. Also records the subscription
 * in our `subscriptions` table as `created`.
 */
export const createRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const planId = process.env.RAZORPAY_PLAN_ID;
    if (!keyId || !keySecret || !planId) {
      throw new Error(
        "Payments are not configured yet. Please try again shortly.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        total_count: 12, // 12 monthly cycles; renews thereafter if not cancelled
        customer_notify: 1,
        notes: { user_id: context.userId },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("Razorpay createSubscription failed", res.status, text);
      throw new Error(`Razorpay error [${res.status}]: ${text}`);
    }
    const sub = JSON.parse(text) as {
      id: string;
      status: string;
      customer_id?: string;
      plan_id: string;
      short_url?: string;
    };

    await supabaseAdmin.from("subscriptions" as any).insert({
      user_id: context.userId,
      razorpay_subscription_id: sub.id,
      razorpay_customer_id: sub.customer_id ?? null,
      plan_id: sub.plan_id,
      status: sub.status,
      raw: sub as any,
    });

    return {
      subscription_id: sub.id,
      key_id: keyId,
      short_url: sub.short_url ?? null,
    };
  });

/**
 * Cancels the user's active Razorpay subscription (at cycle end by default).
 */
export const cancelRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { immediate?: boolean } | undefined) => ({
    immediate: !!data?.immediate,
  }))
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Payments not configured.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub } = await supabaseAdmin
      .from("subscriptions" as any)
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subId = (sub as any)?.razorpay_subscription_id as string | undefined;
    if (!subId) throw new Error("No active subscription found.");

    const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subId}/cancel`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_at_cycle_end: data.immediate ? 0 : 1 }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      console.error("Razorpay cancel failed", res.status, text);
      throw new Error(`Razorpay error [${res.status}]: ${text}`);
    }
    const cancelled = JSON.parse(text);

    await supabaseAdmin
      .from("subscriptions" as any)
      .update({
        status: cancelled.status ?? "cancelled",
        cancelled_at: new Date().toISOString(),
        raw: cancelled,
      })
      .eq("razorpay_subscription_id", subId);

    return { ok: true, status: cancelled.status };
  });
