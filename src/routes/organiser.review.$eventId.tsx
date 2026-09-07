import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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

type Application = {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  answers: Record<string, string | string[]>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  accepted_at: string | null;
  payment_deadline_at: string | null;
  created_at: string;
  updated_at: string;
};

function OrganiserReviewPage() {
  const { eventId } = Route.useParams();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = new URLSearchParams(window.location.search).get("token");

      if (!token) {
        setError("Organiser token is missing.");
        setLoading(false);
        return;
      }

      try {
        // First validate the organiser token.
        const { data: validation, error: validationError } =
          await supabase.rpc(
            "validate_official_event_organiser_token",
            {
              p_event_id: eventId,
              p_token: token,
            }
          );

        if (validationError) {
          throw validationError;
        }

        if (!(validation as any)?.valid) {
          throw new Error("Invalid organiser link");
        }

        setValid(true);

        // Then fetch applications using the same token.
        const { data, error: applicationsError } = await supabase.rpc(
          "get_official_event_applications_by_organiser_token",
          {
            p_event_id: eventId,
            p_token: token,
          }
        );

        if (applicationsError) {
          throw applicationsError;
        }

        setApplications((data ?? []) as Application[]);
      } catch (err) {
        console.error("Organiser review loading failed:", err);
        setError("This organiser link is invalid or expired.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading applications…
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
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-16 pt-8">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Gathr
        </p>

        <h1 className="mt-1 text-2xl font-extrabold">
          Organiser Review
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Review applications for this official event.
        </p>
      </header>

      <div className="mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              Applications
            </p>

            <p className="mt-1 text-2xl font-extrabold">
              {applications.length}
            </p>
          </div>

          <div className="rounded-full bg-primary/10 p-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-border p-6 text-center">
          <User className="mx-auto h-8 w-8 text-muted-foreground" />

          <h2 className="mt-3 text-sm font-bold">
            No applications yet
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Applications for this event will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((application, index) => {
            const open = openId === application.id;

            return (
              <div
                key={application.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenId(open ? null : application.id)
                  }
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        Applicant #{index + 1}
                      </p>

                      <p className="truncate text-xs text-muted-foreground">
                        {application.user_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={application.status} />

                    {open ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border p-4">
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Application answers
                      </p>
                    </div>

                    <div className="space-y-3">
                      {Object.entries(application.answers ?? {}).map(
                        ([questionId, answer]) => (
                          <div
                            key={questionId}
                            className="rounded-xl bg-muted/50 p-3"
                          >
                            <p className="text-[11px] text-muted-foreground">
                              Question ID
                            </p>

                            <p className="mt-1 text-xs font-medium">
                              {questionId}
                            </p>

                            <p className="mt-2 text-sm">
                              {Array.isArray(answer)
                                ? answer.join(", ")
                                : answer}
                            </p>
                          </div>
                        )
                      )}
                    </div>

                    {application.rejection_reason && (
                      <div className="mt-4 rounded-xl bg-destructive/10 p-3">
                        <p className="text-xs font-bold text-destructive">
                          Rejection reason
                        </p>

                        <p className="mt-1 text-sm">
                          {application.rejection_reason}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 text-[11px] text-muted-foreground">
                      Applied{" "}
                      {new Date(
                        application.created_at
                      ).toLocaleString("en-IN")}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted" || status === "confirmed") {
    return (
      <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold capitalize text-green-700">
        {status}
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold capitalize text-destructive">
        rejected
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold capitalize text-amber-700">
      {status}
    </span>
  );
}
