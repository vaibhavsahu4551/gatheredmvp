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

        // Telegram webhook authentication.
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

        // Ignore normal Telegram updates.
        if (!callback) {
          return new Response("ok");
        }

        const callbackId = String(callback.id ?? "");
        const data = String(callback.data ?? "");

        const message = callback.message;

        const chatId = String(
          message?.chat?.id ?? ""
        );

        const messageId = Number(
          message?.message_id ?? 0
        );

        // Only the configured admin chat can approve/reject orders.
        if (chatId !== String(adminChatId)) {
          await telegramApi(botToken, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "Unauthorized",
            show_alert: true,
          }).catch(() => {});

          return new Response("Forbidden", {
            status: 403,
          });
        }

        // Expected:
        // official:approve:<orderId>
        // official:reject:<orderId>
        const match = data.match(
          /^official:(approve|reject):([0-9a-fA-F-]{36})$/
        );

        if (!match) {
          await telegramApi(botToken, "answerCallbackQuery", {
            callback_query_id: callbackId,
            text: "Invalid action",
            show_alert: true,
          }).catch(() => {});

          return new Response("Invalid action", {
            status: 400,
          });
        }

        const action = match[1];
        const orderId = match[2];

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        try {
          if (action === "approve") {
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

            if (message?.photo) {
              await telegramApi(
                botToken,
                "editMessageCaption",
                {
                  chat_id: chatId,
                  message_id: messageId,
                  caption:
                    `✅ <b>APPROVED</b>\n\n` +
                    `<b>Order:</b> ${approvedOrder.order_code}\n` +
                    `<b>Customer:</b> ${approvedOrder.customer_name}\n` +
                    `<b>Amount:</b> ₹${Number(
                      approvedOrder.amount
                    ).toLocaleString("en-IN")}\n\n` +
                    `Ticket is now ACTIVE.`,
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
                  text:
                    `✅ <b>APPROVED</b>\n\n` +
                    `<b>Order:</b> ${approvedOrder.order_code}\n` +
                    `<b>Customer:</b> ${approvedOrder.customer_name}\n` +
                    `<b>Amount:</b> ₹${Number(
                      approvedOrder.amount
                    ).toLocaleString("en-IN")}\n\n` +
                    `Ticket is now ACTIVE.`,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [],
                  },
                }
              );
            }
          }

          if (action === "reject") {
            await telegramApi(
              botToken,
              "answerCallbackQuery",
              {
                callback_query_id: callbackId,
                text: "Choose a rejection reason",
                show_alert: false,
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
        } catch (error: any) {
          const messageText =
            error?.message ??
            "Unable to process this order";

          await telegramApi(
            botToken,
            "answerCallbackQuery",
            {
              callback_query_id: callbackId,
              text: messageText.slice(0, 190),
              show_alert: true,
            }
          ).catch(() => {});

          console.error(
            "Telegram order action failed:",
            error
          );
        }

        return new Response("ok");
      },
    },
  },
});
