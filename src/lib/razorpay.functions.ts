import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac, timingSafeEqual } from "crypto";
import { getPlan } from "@/lib/plans";

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

/**
 * Creates a Razorpay Order for a fixed-duration Premium plan (one-time
 * payment, no silent auto-renewal — users are prompted to resubscribe).
 */
export const createPremiumOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string }) => {
    const plan = getPlan(data?.planId ?? "");
    if (!plan) throw new Error("Unknown plan");
    return { planId: plan.id };
  })
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Payments are not configured yet. Please try again shortly.");
    }
    const plan = getPlan(data.planId)!;

    const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: plan.priceInr * 100,
        currency: "INR",
        notes: { user_id: context.userId, plan_id: plan.id },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Razorpay createOrder failed", res.status, text);
      throw new Error(`Razorpay error [${res.status}]`);
    }
    const order = JSON.parse(text) as { id: string; amount: number };
    return {
      order_id: order.id,
      key_id: keyId,
      amount: order.amount,
      plan_id: plan.id,
      label: plan.label,
      price_inr: plan.priceInr,
    };
  });

/**
 * Verifies a Razorpay payment signature and activates the purchased plan:
 * extends premium expiry and credits bonus points, boosts and badges.
 */
export const verifyPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    planId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const plan = getPlan(data?.planId ?? "");
    if (!plan) throw new Error("Unknown plan");
    if (!data.razorpay_order_id || !data.razorpay_payment_id || !data.razorpay_signature) {
      throw new Error("Missing payment details");
    }
    return {
      planId: plan.id,
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
    };
  })
  .handler(async ({ data, context }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Payments not configured.");
    const plan = getPlan(data.planId)!;

    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(data.razorpay_signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Payment verification failed.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: ignore a payment we already processed.
    const { data: seen } = await supabaseAdmin
      .from("subscriptions" as any)
      .select("id")
      .eq("razorpay_subscription_id", data.razorpay_payment_id)
      .maybeSingle();
    if (seen) return { ok: true, alreadyProcessed: true };

    const { data: expiry, error } = await (supabaseAdmin as any).rpc("apply_premium_purchase", {
      _user: context.userId,
      _plan: plan.label,
      _months: plan.months,
      _bonus_points: plan.bonusPoints,
      _boosts: plan.boosts,
      _founding: plan.founding,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("subscriptions" as any).insert({
      user_id: context.userId,
      razorpay_subscription_id: data.razorpay_payment_id,
      plan_id: plan.id,
      status: "paid",
      current_start: new Date().toISOString(),
      current_end: expiry ?? null,
      raw: {
        kind: "one_time",
        months: plan.months,
        price_inr: plan.priceInr,
        order_id: data.razorpay_order_id,
        payment_id: data.razorpay_payment_id,
      } as any,
    });

    return {
      ok: true,
      expiresAt: expiry as string | null,
      bonusPoints: plan.bonusPoints,
      boosts: plan.boosts,
      founding: plan.founding,
    };
  });
