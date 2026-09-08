import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/**
 * Notifies the admin Telegram chat about a freshly created official-event order.
 * Server-only: bot token / chat id never reach the browser.
 * Idempotent: the order row is claimed via telegram_notified_at before sending.
 */
export const notifyOfficialOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId) throw new Error("orderId is required");
    return { orderId: input.orderId };
  })
  .handler(async ({ data, context }) => {
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    const chatId = process.env["TELEGRAM_ADMIN_CHAT_ID"];
    if (!token || !chatId) return { sent: false, reason: "not_configured" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Only the order's own creator may trigger the notification.
    const { data: order } = await db
      .from("official_orders")
      .select("*")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!order) return { sent: false, reason: "not_found" as const };
    if (order.telegram_notified_at) return { sent: false, reason: "already_sent" as const };

    // Claim the order atomically so retries/double-submits can't duplicate.
    const { data: claimed } = await db
      .from("official_orders")
      .update({ telegram_notified_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("telegram_notified_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return { sent: false, reason: "already_sent" as const };

    try {
      const { data: event } = await db
        .from("official_events")
        .select("title, city, venue")
        .eq("id", order.event_id)
        .maybeSingle();

      // Coupon details (fall back to the snapshot stored on the order).
      let couponCode: string | null = order.coupon_code ?? null;
      let discount = Number(order.discount_amount ?? 0);
      const { data: use } = await db
        .from("official_event_coupon_uses")
        .select("coupon_id, discount_amount")
        .eq("order_id", order.id)
        .maybeSingle();
      if (use) {
        discount = Number(use.discount_amount ?? discount);
        const { data: coupon } = await db
          .from("official_event_coupons")
          .select("code")
          .eq("id", use.coupon_id)
          .maybeSingle();
        couponCode = coupon?.code ?? couponCode;
      }

      const amount = Number(order.amount ?? 0);
      const subtotal = Number(order.subtotal ?? amount + discount);

      const lines = [
        "🎫 <b>New official event order</b>",
        "",
        `<b>Order:</b> ${esc(order.order_code ?? order.id)}`,
        `<b>Event:</b> ${esc(event?.title ?? order.event_id)}`,
        `<b>Pass:</b> ${esc(order.pass_name)}`,
        `<b>Quantity:</b> ${esc(order.quantity)}`,
        `<b>Customer:</b> ${esc(order.customer_name)}`,
        `<b>Phone:</b> ${esc(order.customer_phone)}`,
        `<b>UTR:</b> ${esc(order.utr)}`,
      ];
      if (couponCode && discount > 0) {
        lines.push(
          "",
          `<b>Coupon:</b> ${esc(couponCode)}`,
          `<b>Subtotal:</b> ${inr(subtotal)}`,
          `<b>Discount:</b> −${inr(discount)}`,
        );
      }
      lines.push("", `<b>Payable:</b> ${inr(amount)}`);
      const caption = lines.join("\n");

      const api = `https://api.telegram.org/bot${token}`;

      // Payment screenshot from the private bucket → real Telegram photo upload.
      let photo: Blob | null = null;
      if (order.screenshot_path) {
        const { data: signed } = await db.storage
          .from("payment-proofs")
          .createSignedUrl(order.screenshot_path, 600);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl);
          if (res.ok) photo = await res.blob();
        }
      }

      if (photo) {
        const form = new FormData();
        form.append("chat_id", chatId);
        form.append("caption", caption);
        form.append("parse_mode", "HTML");
        form.append("photo", photo, "payment.jpg");
        const res = await fetch(`${api}/sendPhoto`, { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.text();
          console.error(`Telegram sendPhoto failed [${res.status}]: ${body}`);
          throw new Error(`Telegram sendPhoto failed [${res.status}]`);
        }
        const json = (await res.json()) as { ok?: boolean; description?: string };
        if (!json.ok) throw new Error(json.description ?? "Telegram sendPhoto failed");
      } else {
        const res = await fetch(`${api}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: "HTML" }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error(`Telegram sendMessage failed [${res.status}]: ${body}`);
          throw new Error(`Telegram sendMessage failed [${res.status}]`);
        }
      }

      return { sent: true as const };
    } catch (err) {
      // Release the claim so a later retry can still notify.
      await db
        .from("official_orders")
        .update({ telegram_notified_at: null })
        .eq("id", order.id);
      throw err;
    }
  });
