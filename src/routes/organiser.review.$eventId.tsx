import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  User,
  XCircle,
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
      {
        name: "robots",
        content: "noindex,nofollow",
      },
    ],
  }),
  component: OrganiserReviewPage,
});

type Question = {
  id: string;
  event_id: string;
  question_text: string;
  question_type: string;
  choices: unknown;
  is_required: boolean;
  sort_order: number;
};

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
  applicant_name?: string;
  payment_status?: string | null;
};

function OrganiserReviewPage() {
  const { eventId } = Route.useParams();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");

  const [applications, setApplications] = useState<Application[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [eventTitle, setEventTitle] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadPage();
  }, [eventId]);

  async function loadPage() {
    setLoading(true);
    setError("");

    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      setError("Organiser token is missing.");
      setLoading(false);
      return;
    }

    try {
      // -----------------------------------------
      // 1. Validate organiser token
      // -----------------------------------------

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

      // -----------------------------------------
      // 2. Load event
      // -----------------------------------------

      const { data: event, error: eventError } = await supabase
        .from("official_events")
        .select("title")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError) {
        throw eventError;
      }

      setEventTitle(event?.title ?? "Official Event");

      // -----------------------------------------
      // 3. Load questions
      // -----------------------------------------

      const { data: questionData, error: questionError } =
        await supabase
          .from("official_event_application_questions")
          .select(
            `
              id,
              event_id,
              question_text,
              question_type,
              choices,
              is_required,
              sort_order
            `
          )
          .eq("event_id", eventId)
          .order("sort_order", { ascending: true });

      if (questionError) {
        throw questionError;
      }

      setQuestions((questionData ?? []) as Question[]);

      // -----------------------------------------
      // 4. Load applications using organiser token
      // -----------------------------------------

      const { data: applicationData, error: applicationsError } =
        await supabase.rpc(
          "get_official_event_applications_by_organiser_token",
          {
            p_event_id: eventId,
            p_token: token,
          }
        );

      if (applicationsError) {
        throw applicationsError;
      }

      const rawApplications =
        (applicationData ?? []) as Application[];

      // -----------------------------------------
      // 5. Get applicant names
      // -----------------------------------------

      const userIds = [
        ...new Set(
          rawApplications
            .map((application) => application.user_id)
            .filter(Boolean)
        ),
      ];

      let profiles: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);

        if (profileError) {
          throw profileError;
        }

        profiles = Object.fromEntries(
          (profileData ?? []).map((profile) => [
            profile.id,
            profile.full_name || "Gathr User",
          ])
        );
      }

      // -----------------------------------------
      // 6. Get payment status
      // -----------------------------------------

      const { data: orderData, error: orderError } =
        await supabase
          .from("official_orders")
          .select("user_id, event_id, payment_status")
          .eq("event_id", eventId)
          .in("user_id", userIds);

      if (orderError) {
        throw orderError;
      }

      const paymentMap = new Map<string, string>();

      (orderData ?? []).forEach((order) => {
        paymentMap.set(
          `${order.user_id}_${order.event_id}`,
          order.payment_status
        );
      });

      // -----------------------------------------
      // 7. Merge everything
      // -----------------------------------------

      const finalApplications = rawApplications.map(
        (application) => ({
          ...application,
          applicant_name:
            profiles[application.user_id] || "Gathr User",
          payment_status:
            paymentMap.get(
              `${application.user_id}_${application.event_id}`
            ) ?? null,
        })
      );

      setApplications(finalApplications);
    } catch (err) {
      console.error(
        "Organiser review loading failed:",
        err
      );

      setValid(false);
      setError(
        "This organiser link is invalid or expired."
      );
    } finally {
      setLoading(false);
    }
  }

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
      {/* HEADER */}

      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Gathr
        </p>

        <h1 className="mt-1 text-2xl font-extrabold">
          Organiser Review
        </h1>

        <p className="mt-1 text-sm font-medium">
          {eventTitle}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          Review applications for this official event.
        </p>
      </header>

      {/* APPLICATION COUNT */}

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

      {/* APPLICATIONS */}

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
                {/* APPLICANT HEADER */}

                <button
                  type="button"
                  onClick={() =>
                    setOpenId(
                      open ? null : application.id
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {application.applicant_name ||
                          `Applicant #${index + 1}`}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {getDisplayStatus(application)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      status={application.status}
                      paymentStatus={
                        application.payment_status
                      }
                    />

                    {open ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* DETAILS */}

                {open && (
                  <div className="border-t border-border p-4">
                    {/* PAYMENT */}

                    <div className="mb-5 rounded-xl bg-muted/50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Payment
                          </p>

                          <p className="mt-1 text-sm font-bold">
                            {getPaymentLabel(
                              application
                            )}
                          </p>
                        </div>

                        <PaymentIcon
                          application={application}
                        />
                      </div>

                      {application.payment_deadline_at &&
                        application.status ===
                          "payment_pending" && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Deadline:{" "}
                            {new Date(
                              application.payment_deadline_at
                            ).toLocaleString("en-IN")}
                          </p>
                        )}
                    </div>

                    {/* QUESTIONS */}

                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Application Answers
                      </p>

                      {questions.length === 0 ? (
                        <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                          No questions configured for this
                          event.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {questions.map((question) => {
                            const answer =
                              application.answers?.[
                                question.id
                              ];

                            return (
                              <div
                                key={question.id}
                                className="rounded-xl bg-muted/50 p-3"
                              >
                                <p className="text-xs font-semibold">
                                  {question.question_text}
                                </p>

                                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                                  {formatAnswer(answer)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* REJECTION REASON */}

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

                    {/* APPLICATION DATE */}

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

      {/* REFRESH */}

      <button
        type="button"
        onClick={loadPage}
        className="mx-auto mt-6 flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold"
      >
        Refresh status
      </button>
    </div>
  );
}

/* ---------------------------------------------
   STATUS HELPERS
--------------------------------------------- */

function getDisplayStatus(application: Application) {
  if (
    application.payment_status === "APPROVED" ||
    application.status === "confirmed"
  ) {
    return "Payment confirmed";
  }

  if (application.status === "payment_pending") {
    return "Waiting for payment";
  }

  if (application.status === "rejected") {
    return "Application rejected";
  }

  return "Application pending";
}

function getPaymentLabel(application: Application) {
  if (
    application.payment_status === "APPROVED" ||
    application.status === "confirmed"
  ) {
    return "Payment Confirmed";
  }

  if (application.payment_status) {
    return application.payment_status;
  }

  if (application.status === "payment_pending") {
    return "Payment Pending";
  }

  return "Not paid";
}

function formatAnswer(
  answer: string | string[] | undefined
) {
  if (answer === undefined || answer === null) {
    return "No answer provided";
  }

  if (Array.isArray(answer)) {
    return answer.length > 0
      ? answer.join(", ")
      : "No answer provided";
  }

  if (typeof answer === "string" && answer.trim() === "") {
    return "No answer provided";
  }

  return String(answer);
}

function StatusBadge({
  status,
  paymentStatus,
}: {
  status: string;
  paymentStatus?: string | null;
}) {
  if (
    paymentStatus === "APPROVED" ||
    status === "confirmed"
  ) {
    return (
      <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-700">
        Paid
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">
        Rejected
      </span>
    );
  }

  if (status === "payment_pending") {
    return (
      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700">
        Payment Pending
      </span>
    );
  }

  return (
    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
      Pending
    </span>
  );
}

function PaymentIcon({
  application,
}: {
  application: Application;
}) {
  if (
    application.payment_status === "APPROVED" ||
    application.status === "confirmed"
  ) {
    return (
      <div className="rounded-full bg-green-500/10 p-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      </div>
    );
  }

  if (application.status === "rejected") {
    return (
      <div className="rounded-full bg-destructive/10 p-2">
        <XCircle className="h-5 w-5 text-destructive" />
      </div>
    );
  }

  return (
    <div className="rounded-full bg-amber-500/10 p-2">
      <Clock3 className="h-5 w-5 text-amber-600" />
    </div>
  );
}
