import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const inputSchema = z.object({ eventId: z.string().uuid() });

export const getOfficialEventSeo = createServerFn({ method: "GET" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: event } = await client
      .from("official_events")
      .select("title, description, cover_url, published")
      .eq("id", data.eventId)
      .eq("published", true)
      .maybeSingle();

    if (!event) return null;
    return {
      title: event.title,
      description: event.description,
      coverUrl: event.cover_url && /^https:\/\//.test(event.cover_url) ? event.cover_url : null,
    };
  });