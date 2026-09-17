import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function hmacSha256(message: string, secret: string) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !razorpaySecret) {
      return json(
        {
          success: false,
          error: "Required server configuration is missing",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json(
        {
          success: false,
          error: "Authentication required",
        },
        401,
      );
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return json(
        {
          success: false,
          error: "Invalid authentication",
        },
        401,
      );
    }

    const body = await req.json();

    const {
      eventId,
      passId,
      quantity,
      customerName,
      customerPhone,
      customerEmail,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = body;

    if (
      !eventId ||
      !passId ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return json(
        {
          success: false,
          error: "Missing payment information",
        },
        400,
      );
    }

    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      return json(
        {
          success: false,
          error: "Invalid quantity",
        },
        400,
      );
    }

    if (!customerName?.trim()) {
      return json(
        {
          success: false,
          error: "Customer name is required",
        },
        400,
      );
    }

    if (!customerPhone?.trim()) {
      return json(
        {
          success: false,
          error: "Customer phone is required",
        },
        400,
      );
    }

    /* ---------------------------------------------
       VERIFY RAZORPAY SIGNATURE
    --------------------------------------------- */

    const expectedSignature = await hmacSha256(
      `${razorpayOrderId}|${razorpayPaymentId}`,
      razorpaySecret,
    );

    if (expectedSignature !== razorpaySignature) {
      return json(
        {
          success: false,
          error: "Invalid Razorpay payment signature",
        },
        400,
      );
    }

    /* ---------------------------------------------
       LOAD EVENT
    --------------------------------------------- */

    const { data: event, error: eventError } = await supabase
      .from("official_events")
      .select(
        "id, title, razorpay_enabled",
      )
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      throw eventError;
    }

    if (!event) {
      return json(
        {
          success: false,
          error: "Event not found",
        },
        404,
      );
    }

    if (!event.razorpay_enabled) {
      return json(
        {
          success: false,
          error: "Razorpay is not enabled for this event",
        },
        400,
      );
    }

    /* ---------------------------------------------
       LOAD PASS
    --------------------------------------------- */

    const { data: pass, error: passError } = await supabase
      .from("official_event_passes")
      .select(
        "id, name, price, total_quantity, sold_quantity, active",
      )
      .eq("id", passId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (passError) {
      throw passError;
    }

    if (!pass) {
      return json(
        {
          success: false,
          error: "Pass not found",
        },
        404,
      );
    }

    if (!pass.active) {
      return json(
        {
          success: false,
          error: "This pass is no longer active",
        },
        400,
      );
    }

    const remaining =
      Number(pass.total_quantity) > 0
        ? Number(pass.total_quantity) - Number(pass.sold_quantity)
        : Infinity;

    if (qty > remaining) {
      return json(
        {
          success: false,
          error: "Not enough passes available",
        },
        400,
      );
    }

    /* ---------------------------------------------
       CALCULATE SERVER-SIDE AMOUNT
    --------------------------------------------- */

    const amount =
      Number(pass.price) * qty;

    if (!Number.isFinite(amount) || amount < 0) {
      return json(
        {
          success: false,
          error: "Invalid order amount",
        },
        400,
      );
    }

    /* ---------------------------------------------
       PREVENT DUPLICATE PAYMENT
    --------------------------------------------- */

    const { data: existingOrder, error: existingError } =
      await supabase
        .from("official_orders")
        .select("id, order_code")
        .or(
          `razorpay_order_id.eq.${razorpayOrderId},razorpay_payment_id.eq.${razorpayPaymentId}`,
        )
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingOrder) {
      return json({
        success: true,
        order_id: existingOrder.id,
        order_code: existingOrder.order_code,
        already_processed: true,
      });
    }

    /* ---------------------------------------------
       CREATE APPROVED GATHR ORDER
    --------------------------------------------- */

    const { data: order, error: orderError } = await supabase
      .from("official_orders")
      .insert({
        user_id: user.id,
        event_id: eventId,
        pass_id: passId,
        pass_name: pass.name,
        quantity: qty,
        amount,
        utr: null,
        screenshot_path: null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email:
          customerEmail?.trim() || null,

        payment_status: "APPROVED",
        ticket_status: "ACTIVE",

        payment_method: "razorpay",
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,

        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .select("id, order_code")
      .single();

    if (orderError) {
      throw orderError;
    }

    return json({
      success: true,
      order_id: order.id,
      order_code: order.order_code,
    });
  } catch (error) {
    console.error(
      "verify-razorpay-payment error:",
      error,
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment verification failed",
      },
      500,
    );
  }
});
