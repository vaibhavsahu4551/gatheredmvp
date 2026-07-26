import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs an NSFW / explicit-content check on a user-provided image using the
 * Lovable AI Gateway (Gemini vision). Returns { safe, reason } — never throws
 * for policy failures, only for infra failures. Caller must be authenticated.
 */
export const moderatePrideImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { dataUrl: string }) => {
    if (!data?.dataUrl || !data.dataUrl.startsWith("data:image/")) {
      throw new Error("Invalid image payload");
    }
    if (data.dataUrl.length > 8_000_000) throw new Error("Image too large");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // Fail-closed: without moderation configured, block the upload.
      return { safe: false, reason: "Image moderation is unavailable — please try again later." };
    }

    const prompt =
      "You are a strict content-safety classifier for a social app. " +
      "Look at the image and answer with a single JSON object on one line, no prose, no markdown:\n" +
      `{"nsfw": boolean, "nudity": boolean, "sexual": boolean, "reason": string}\n` +
      "nsfw=true if the image contains nudity, sexual/erotic content, sex acts, exposed genitals, exposed female nipples, or explicit sexual context. " +
      "Otherwise nsfw=false. Keep 'reason' under 12 words.";

    let raw = "";
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: data.dataUrl } },
              ],
            },
          ],
          temperature: 0,
        }),
      });
      if (!res.ok) {
        console.error("moderatePrideImage upstream error", res.status, await res.text());
        return { safe: false, reason: "Moderation service unavailable — try again shortly." };
      }
      const json: any = await res.json();
      raw = json?.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      console.error("moderatePrideImage fetch failed", e);
      return { safe: false, reason: "Moderation service unavailable — try again shortly." };
    }

    // Parse the model's JSON verdict; be defensive.
    let verdict: { nsfw?: boolean; nudity?: boolean; sexual?: boolean; reason?: string } = {};
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) verdict = JSON.parse(match[0]);
    } catch { /* ignore, fall through */ }

    const flagged = !!(verdict.nsfw || verdict.nudity || verdict.sexual);
    if (flagged) {
      return {
        safe: false,
        reason:
          verdict.reason?.trim() ||
          "This image looks like it contains nudity or explicit content, which isn't allowed.",
      };
    }
    return { safe: true, reason: "" };
  });
