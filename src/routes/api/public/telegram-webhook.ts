import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  return (
    aBuf.length === bBuf.length &&
    timingSafeEqual(aBuf, bBuf)
  );
}

async function telegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>
) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const json = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: any;
  };

  if (!response.ok || !json.ok) {
    throw new Error(
      json.description ?? `Telegram ${method} failed`
    );
  }

  return json.result;
}

export const Route = createFileRoute("/api/public/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret =
          process.env["TELEGRAM_WEBHOOK_SECRET"];

        const botToken =
          process.env["TELEGRAM_BOT_TOKEN"];

        const adminChatId =
          process.env["TELEGRAM_ADMIN_CHAT_ID"];

        if (!webhookSecret || !botToken || !adminChatId) {
          console.error(
            "Telegram webhook secrets are not configured"
          );

          return new Response("Not configured", {
            status: 500,
          });
        }

        // Verify that the request came through the
        // Telegram webhook configured with our secret.
        const incomingSecret =
          request.headers.get(
            "x-telegram-bot-api-secret-token"
          ) ?? "";

        if (!safeEqual(incomingSecret, webhookSecret)) {
          return new Response("Unauthorized", {
            status: 401,
          });
        }

        let payload: any;

        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", {
            status: 400,
          });
        }

        const callback = payload?.callback_query;

        // Ignore updates that are not button presses.
        if (!callback) {
          return new Response("ok");
        }

        const callbackId = String(callback.id ?? "");
        const callbackData = String(callback.data ?? "");

        const message = callback.message;

        const chatId = String(
          message?.chat?.id ?? ""
        );

        const messageId = Number(
          message?.message_id ?? 0
        );

        // Only the configured Telegram admin chat
        // can approve/reject orders.
        if (chatId !== String(adminChatId)) {
          await telegramApi(
            botToken,
            "answerCallbackQuery",
            {
              callback_query_id: callbackId,
              text: "Unauthorized",
              show_alert: true,
            }
          ).catch(() => {});

          return new Response("Forbidden", {
            status: 403,
          });
        }

        const approveMatch = callbackData.match(
          /^official:approve:([0-9a-fA-F-]{36})$/
        );

        const rejectMatch = callbackData.match(
          /^official:reject:([0-9a-fA-F-]{36})$/
        );

        const rejectReasonMatch = callbackData.match(
          /^official:reject_reason:([0-9a-fA-F-]{36}):([A-Z_]+)$/
        );

        if (
          !approveMatch &&
          !rejectMatch &&
          !rejectReasonMatch
        ) {
          await telegramApi(
            botToken,
            "answerCallbackQuery",
            {
              callback_query_id: callbackId,
              text: "Invalid action",
              show_alert: true,
            }
          ).catch(() => {});

          return new Response("Invalid action", {
            status: 400,
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        try {
          // ==========================================
          // APPROVE
          // ==========================================
          if (approveMatch) {
            const orderId = approveMatch[1];

            const { data: order, error } =
              await supabaseAdmin.rpc(
                "telegram_approve_official_order",
                {
                  p_order_id: orderId,
                }
              );

            if (error) {
              throw error;
            }

            const approvedOrder = order as any;

            await telegramApi(
              botToken,
              "answerCallbackQuery",
              {
                callback_query_id: callbackId,
                text: "Payment approved ✓",
              }
            );

            const approvedText =
              `✅ <b>PAYMENT APPROVED</b>\n\n` +
              `<b>Order:</b> ${escapeHtml(
                approvedOrder.order_code
              )}\n` +
              `<b>Customer:</b> ${escapeHtml(
                approvedOrder.customer_name
              )}\n` +
              `<b>Amount:</b> ₹${Number(
                approvedOrder.amount
              ).toLocaleString("en-IN")}\n\n` +
              `🎫 <b>Ticket:</b> ACTIVE`;

            if (message?.photo) {
              await telegramApi(
                botToken,
                "editMessageCaption",
                {
                  chat_id: chatId,
                  message_id: messageId,
                  caption: approvedText,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [],
                  },
                }
              );
            } else {
              await telegramApi(
                botToken,
                "editMessageText",
                {
                  chat_id: chatId,
                  message_id: messageId,
                  text: approvedText,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [],
                  },
                }
              );
            }
          }

          // ==========================================
          // REJECT BUTTON
          // ==========================================
          if (rejectMatch) {
            const orderId = rejectMatch[1];

            await telegramApi(
              botToken,
              "answerCallbackQuery",
              {
                callback_query_id: callbackId,
                text: "Choose a rejection reason",
              }
            );

            await telegramApi(
              botToken,
              "editMessageReplyMarkup",
              {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "❌ UTR not found",
                        callback_data:
                          `official:reject_reason:${orderId}:UTR_NOT_FOUND`,
                      },
                    ],
                    [
                      {
                        text: "❌ Payment not received",
                        callback_data:
                          `official:reject_reason:${orderId}:PAYMENT_NOT_RECEIVED`,
                      },
                    ],
                    [
                      {
                        text: "❌ Invalid screenshot",
                        callback_data:
                          `official:reject_reason:${orderId}:INVALID_SCREENSHOT`,
                      },
                    ],
                  ],
                },
              }
            );
          }

          // ==========================================
          // REJECT WITH REASON
          // ==========================================
          if (rejectReasonMatch) {
            const orderId = rejectReasonMatch[1];
            const reasonCode = rejectReasonMatch[2];

            const reasons: Record<string, string> = {
              UTR_NOT_FOUND: "UTR not found",
              PAYMENT_NOT_RECEIVED: "Payment not received",
              INVALID_SCREENSHOT: "Invalid payment screenshot",
            };

            const reason =
              reasons[reasonCode];

            if (!reason) {
              throw new Error(
                "Invalid rejection reason"
              );
            }

            const { data: order, error } =
              await supabaseAdmin.rpc(
                "telegram_reject_official_order",
                {
                  p_order_id: orderId,
                  p_reason: reason,
                }
              );

            if (error) {
              throw error;
            }

            const rejectedOrder = order as any;

            await telegramApi(
              botToken,
              "answerCallbackQuery",
              {
                callback_query_id: callbackId,
                text: "Order rejected",
              }
            );

            const rejectedText =
              `❌ <b>PAYMENT REJECTED</b>\n\n` +
              `<b>Order:</b> ${escapeHtml(
                rejectedOrder.order_code
              )}\n` +
              `<b>Customer:</b> ${escapeHtml(
                rejectedOrder.customer_name
              )}\n` +
              `<b>Amount:</b> ₹${Number(
                rejectedOrder.amount
              ).toLocaleString("en-IN")}\n` +
              `<b>Reason:</b> ${escapeHtml(
                reason
              )}\n\n` +
              `🎫 <b>Ticket:</b> CANCELLED`;

            if (message?.photo) {
              await telegramApi(
                botToken,
                "editMessageCaption",
                {
                  chat_id: chatId,
                  message_id: messageId,
                  caption: rejectedText,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [],
                  },
                }
              );
            } else {
              await telegramApi(
                botToken,
                "editMessageText",
                {
                  chat_id: chatId,
                  message_id: messageId,
                  text: rejectedText,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [],
                  },
                }
              );
            }
          }
        } catch (error: any) {
          console.error(
            "Telegram order action failed:",
            error
          );

          await telegramApi(
            botToken,
            "answerCallbackQuery",
            {
              callback_query_id: callbackId,
              text: (
                error?.message ??
                "Unable to process order"
              ).slice(0, 190),
              show_alert: true,
            }
          ).catch(() => {});
        }

        return new Response("ok");
      },
    },
  },
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
