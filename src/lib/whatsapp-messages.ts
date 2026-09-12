/**
 * Per-event WhatsApp message templates for Official Event applications.
 * Used by the organiser review screen (accept / reject) and configured
 * per event in the admin Official Events editor.
 */

export const DEFAULT_ACCEPT_MESSAGE = `Hi {name}! 🎉

Your application for {event_name} has been accepted.

Please complete your payment to confirm your spot.`;

export const DEFAULT_REJECT_MESSAGE = `Hi {name},

Thank you for applying for {event_name}.

Unfortunately, your application was not selected this time.

Thank you for your interest in Gathr. ❤️`;

export type WhatsAppVars = {
  name?: string | null;
  event_name?: string | null;
  payment_deadline?: string | null;
  payment_link?: string | null;
  reason?: string | null;
};

/** Replaces supported {variables}; unknown/empty ones are removed cleanly. */
export function renderWhatsAppMessage(template: string, vars: WhatsAppVars) {
  const map: Record<string, string> = {
    name: (vars.name || "").trim() || "there",
    event_name: (vars.event_name || "").trim() || "this event",
    payment_deadline: (vars.payment_deadline || "").trim(),
    payment_link: (vars.payment_link || "").trim(),
    reason: (vars.reason || "").trim(),
  };

  return template
    .replace(/\{(\w+)\}/g, (match, key: string) =>
      key in map ? map[key] : match,
    )
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Normalises an Indian-style phone number for wa.me. Empty when unusable. */
export function cleanWhatsAppPhone(phone?: string | null) {
  let cleaned = (phone ?? "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("0")) cleaned = "91" + cleaned.slice(1);
  if (cleaned.length === 10) cleaned = "91" + cleaned;
  if (cleaned.length < 11 || cleaned.length > 15) return "";
  return cleaned;
}

/** wa.me link with a properly URL-encoded prefilled message. */
export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
