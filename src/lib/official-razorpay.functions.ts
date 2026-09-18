import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay checkout for Official Event passes.
 *
 * Everything that decides money or entitlement happens here on the server:
 * pass price, coupon discount, final amount, signature verification and the
 * creation of the APPROVED + ACTIVE ticket. The browser is never trusted.
 *
 * The manual UPI flow (create_official_order_with_coupon) is untouched.
 */

type Money = number;

function round2(n: number): Money {
  return Number(n.toFixed(2));
}

function rzpAuth() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new Error("Online payments are not configured yet.");
  }
  return {
    keyId,
    keySecret,
    header: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
  };
}

/* ------------------------------------------------------------------ */
/* 1. CREATE ORDER                                                     */
/* ------------------------------------------------------------------ */

export const createOfficialRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    eventId: string;
    passId: string;
    quantity: number;
    couponCode?: string | null;
  }) => {
    if (!data?.eventId || !data?.passId) throw new Error("Missing event or pass");
    const quantity = Number(data.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("Invalid quantity");
    }
    return {
      eventId: data.eventId,
      passId: data.passId,
      quantity,
      couponCode: data.couponCode?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { keyId, header } = rzpAuth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: event, error: eventErr } = await supabaseAdmin
      .from("official_events" as any)
      .select("id, title, razorpay_enabled, published")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventErr) throw new Error(eventErr.message);
    if (!event) throw new Error("Event not found");
    if (!(event as any).razorpay_enabled) {
      throw new Error("Online payment is not enabled for this event");
    }

    const { data: pass, error: passErr } = await supabaseAdmin
      .from("official_event_passes" as any)
      .select("id, name, price, total_quantity, sold_quantity, active")
      .eq("id", data.passId)
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (passErr) throw new Error(passErr.message);
    if (!pass) throw new Error("Pass not found");
    if (!(pass as any).active) throw new Error("This pass is no longer active");

    const total = Number((pass as any).total_quantity);
    const sold = Number((pass as any).sold_quantity);
    if (total > 0 && sold + data.quantity > total) {
      throw new Error("Not enough passes available");
    }

    const subtotal = round2(Number((pass as any).price) * data.quantity);

    // Coupon is validated server-side by the existing database function.
    let couponId: string | null = null;
    let discount = 0;
    let couponCode: string | null = null;

    if (data.couponCode) {
      const { data: result, error: couponErr } = await (supabaseAdmin as any).rpc(
        "validate_official_event_coupon",
        {
          p_event_id: data.eventId,
          p_coupon_code: data.couponCode,
          p_user_id: context.userId,
          p_subtotal: subtotal,
        },
      );
      if (couponErr) throw new Error(couponErr.message || "Invalid coupon code");
      couponId = result?.coupon_id ?? null;
      couponCode = result?.code ?? null;
      discount = round2(Number(result?.discount_amount ?? 0));
    }

    const finalAmount = round2(Math.max(0, subtotal - discount));
    const paise = Math.round(finalAmount * 100);
    if (!Number.isFinite(paise) || paise <= 0) {
      throw new Error("This pass cannot be paid for online");
    }

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: header, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: paise,
        currency: "INR",
        receipt: `gathr_${Date.now()}`,
        notes: {
          user_id: context.userId,
          event_id: data.eventId,
          pass_id: data.passId,
          pass_name: (pass as any).name,
          quantity: String(data.quantity),
          coupon_id: couponId ?? "",
          final_amount: finalAmount.toFixed(2),
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Razorpay order create failed", res.status, text);
      throw new Error("Unable to start the payment. Please try again.");
    }
    const order = JSON.parse(text) as { id: string; amount: number; currency: string };

    return {
      success: true as const,
      key_id: keyId,
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
      event_id: data.eventId,
      event_title: (event as any).title as string,
      pass_id: data.passId,
      pass_name: (pass as any).name as string,
      quantity: data.quantity,
      subtotal,
      discount_amount: discount,
      coupon_code: couponCode,
      final_amount: finalAmount,
    };
  });

/* ------------------------------------------------------------------ */
/* 2. VERIFY PAYMENT + AUTO-ACTIVATE TICKET                            */
/* ------------------------------------------------------------------ */

export const verifyOfficialRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
  }) => {
    if (!data?.razorpay_order_id || !data?.razorpay_payment_id || !data?.razorpay_signature) {
      throw new Error("Missing payment details");
    }
    if (!data.customerName?.trim()) throw new Error("Customer name is required");
    if (!data.customerPhone?.trim()) throw new Error("Customer phone is required");
    return {
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      customerEmail: data.customerEmail?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { keySecret, header } = rzpAuth();

    // --- signature ---
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(data.razorpay_signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Payment verification failed.");
    }

    // --- authoritative order + payment from Razorpay ---
    const [orderRes, paymentRes] = await Promise.all([
      fetch(`https://api.razorpay.com/v1/orders/${data.razorpay_order_id}`, {
        headers: { Authorization: header },
      }),
      fetch(`https://api.razorpay.com/v1/payments/${data.razorpay_payment_id}`, {
        headers: { Authorization: header },
      }),
    ]);
    if (!orderRes.ok || !paymentRes.ok) {
      throw new Error("Could not confirm the payment with Razorpay.");
    }
    const order = (await orderRes.json()) as {
      id: string;
      amount: number;
      status: string;
      notes?: Record<string, string>;
    };
    const payment = (await paymentRes.json()) as {
      id: string;
      order_id: string;
      amount: number;
      status: string;
      captured?: boolean;
    };

    if (payment.order_id !== order.id) {
      throw new Error("Payment does not belong to this order.");
    }
    if (!["captured", "authorized"].includes(payment.status)) {
      throw new Error("Payment was not completed.");
    }
    if (Number(payment.amount) !== Number(order.amount)) {
      throw new Error("Paid amount does not match the order.");
    }

    const notes = order.notes ?? {};
    if (notes["user_id"] && notes["user_id"] !== context.userId) {
      throw new Error("This payment belongs to another account.");
    }

    const eventId = notes["event_id"];
    const passId = notes["pass_id"];
    const quantity = Number(notes["quantity"] ?? 0);
    const couponId = notes["coupon_id"] || null;
    if (!eventId || !passId || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Payment order is missing booking details.");
    }

    const paidAmount = round2(Number(order.amount) / 100);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await (supabaseAdmin as any).rpc(
      "create_verified_razorpay_official_order",
      {
        p_user_id: context.userId,
        p_event_id: eventId,
        p_pass_id: passId,
        p_quantity: quantity,
        p_paid_amount: paidAmount,
        p_customer_name: data.customerName,
        p_customer_phone: data.customerPhone,
        p_customer_email: data.customerEmail,
        p_coupon_id: couponId,
        p_razorpay_order_id: data.razorpay_order_id,
        p_razorpay_payment_id: data.razorpay_payment_id,
        p_razorpay_signature: data.razorpay_signature,
      },
    );
    if (error) throw new Error(error.message || "Could not confirm your ticket.");

    const row = Array.isArray(created) ? created[0] : created;

    return {
      success: true as const,
      order_id: row?.id as string,
      order_code: row?.order_code as string,
      amount: Number(row?.amount ?? paidAmount),
      already_processed:
        row?.razorpay_payment_id != null &&
        row?.razorpay_payment_id !== data.razorpay_payment_id,
    };
  });
