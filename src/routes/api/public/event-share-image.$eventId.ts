import { createFileRoute } from "@tanstack/react-router";

const FALLBACK_IMAGE = "https://gathrmeet.in/__l5e/assets-v1/9a99cb0a-7c14-4be1-8f90-90cbb85b6876/gathr-social-share.jpg";

export const Route = createFileRoute("/api/public/event-share-image/$eventId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: event } = await supabaseAdmin
          .from("official_events" as any)
          .select("cover_url, published")
          .eq("id", params.eventId)
          .eq("published", true)
          .maybeSingle();

        const cover = (event as { cover_url?: string | null } | null)?.cover_url;
        if (!cover) return Response.redirect(FALLBACK_IMAGE, 302);

        try {
          if (/^https:\/\//.test(cover)) {
            const response = await fetch(cover);
            if (!response.ok || !response.body) return Response.redirect(FALLBACK_IMAGE, 302);
            return new Response(response.body, {
              headers: {
                "Content-Type": response.headers.get("content-type") || "image/jpeg",
                "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
              },
            });
          }

          const { data, error } = await supabaseAdmin.storage.from("event-photos").download(cover);
          if (error || !data) return Response.redirect(FALLBACK_IMAGE, 302);
          return new Response(data, {
            headers: {
              "Content-Type": data.type || "image/jpeg",
              "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            },
          });
        } catch {
          return Response.redirect(FALLBACK_IMAGE, 302);
        }
      },
    },
  },
});