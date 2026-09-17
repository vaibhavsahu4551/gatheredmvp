import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !razorpayKeyId ||
      !razorpayKeySecret ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error("Required server secrets are missing");
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

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

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
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
    } = body;

    if (!eventId || !quantity || quantity < 1) {
      return new Response(
        JSON.stringify({
          error: "Invalid event or quantity",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!customerName || !customerPhone) {
      return new Response(
        JSON.stringify({
          error: "Customer name and phone are required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("official_events")
      .select("id, title, razorpay_enabled")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      throw eventError;
    }

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!event.razorpay_enabled) {
      return new Response(
        JSON.stringify({
          error: "Razorpay is not enabled for this event",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    let passName = "Event Pass";
    let price = 0;

    if (passId) {
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
        return new Response(
          JSON.stringify({ error: "Pass not found" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (!pass.active) {
        return new Response(
          JSON.stringify({ error: "This pass is inactive" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const remaining =
        Number(pass.total_quantity) - Number(pass.sold_quantity);

      if (remaining < Number(quantity)) {
        return new Response(
          JSON.stringify({
            error: "Not enough passes available",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      passName = pass.name;
      price = Number(pass.price);
    } else {
      const { data: eventData, error: eventDataError } = await supabase
        .from("official_events")
        .select("pass_price")
        .eq("id", eventId)
        .maybeSingle();

      if (eventDataError) {
        throw eventDataError;
      }

      if (!eventData) {
        return new Response(
          JSON.stringify({ error: "Event pricing not found" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      price = Number(eventData.pass_price ?? 0);
    }

    const amount = Math.round(price * Number(quantity) * 100);

    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid payment amount",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            btoa(`${razorpayKeyId}:${razorpayKeySecret}`),
        },
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt: `gathr_${Date.now()}`,
          notes: {
            event_id: eventId,
            pass_id: passId ?? "",
            user_id: user.id,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail ?? "",
            pass_name: passName,
          },
        }),
      },
    );

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error("Razorpay order creation failed:", razorpayData);

      return new Response(
        JSON.stringify({
          error: "Unable to create Razorpay order",
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        key_id: razorpayKeyId,
        razorpay_order_id: razorpayData.id,
        amount: razorpayData.amount,
        currency: razorpayData.currency,
        event_id: eventId,
        event_title: event.title,
        pass_id: passId ?? null,
        pass_name: passName,
        quantity: Number(quantity),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("create-razorpay-order error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
