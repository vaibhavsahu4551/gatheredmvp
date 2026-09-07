import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/organiser/review/$eventId")({
  head: () => ({
    meta: [
      { title: "Organiser Review — Gathr" },
      {
        name: "description",
        content: "Review applications for a Gathr official event.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OrganiserReviewPage,
});

type TokenValidation = {
  valid: boolean;
  event_id: string;
  expires_at: string;
};

function OrganiserReviewPage() {
  const { eventId } = Route.useParams();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function validate() {
      const token = new URLSearchParams(window.location.search).get("token");

      if (!token) {
        setError("Organiser token is missing.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc(
          "validate_official_event_organiser_token",
          {
            p_event_id: eventId,
            p_token: token,
          }
        );

        if (error) throw error;

        const result = data as TokenValidation;

        if (!result?.valid) {
          setError("This organiser link is invalid or expired.");
          return;
        }

        setValid(true);
      } catch (err) {
        console.error("Organiser token validation failed:", err);
        setError("This organiser link is invalid or expired.");
      } finally {
        setLoading(false);
      }
    }

    validate();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating organiser link…
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>

        <h1 className="text-xl font-extrabold">
          Invalid organiser link
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {error ||
            "This organiser link is invalid or has expired. Please ask the Gathr team for a new link."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-16 pt-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Gathr
          </p>

          <h1 className="text-xl font-extrabold">
            Organiser Review
          </h1>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">
          Link verified
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          You have access to review applications for this official event.
        </p>

        <div className="mt-4 rounded-xl bg-muted/50 p-3">
          <p className="text-[11px] font-medium text-muted-foreground">
            Event ID
          </p>

          <p className="mt-1 break-all font-mono text-xs">
            {eventId}
          </p>
        </div>
      </div>
    </div>
  );
}
