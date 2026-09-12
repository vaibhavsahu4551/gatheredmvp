import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  MessageCircle,
  User,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ACCEPT_MESSAGE,
  DEFAULT_REJECT_MESSAGE,
  cleanWhatsAppPhone,
  renderWhatsAppMessage,
  whatsappLink,
} from "@/lib/whatsapp-messages";

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
  applicant_phone?: string | null;
  payment_status?: string | null;
};

type ReviewData = {
  event: {
    id: string;
    title: string;
    ticket_url: string | null;
    pass_price: number | null;
    price_text: string | null;
    whatsapp_accept_message?: string | null;
    whatsapp_reject_message?: string | null;
  } | null;

  questions: Question[];
  applications: Application[];
};

function OrganiserReviewPage() {
  const { eventId } = Route.useParams();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");

  const [applications, setApplications] = useState<Application[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [eventTitle, setEventTitle] = useState("");
  const [eventTicketUrl, setEventTicketUrl] = useState("");
  const [acceptTemplate, setAcceptTemplate] = useState(DEFAULT_ACCEPT_MESSAGE);
  const [rejectTemplate, setRejectTemplate] = useState(DEFAULT_REJECT_MESSAGE);

  const [openId, setOpenId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [whatsappApplication, setWhatsappApplication] =
  useState<Application | null>(null);

const [whatsappMessage, setWhatsappMessage] =
  useState("");

const [whatsappOpen, setWhatsappOpen] =
  
  useState(false);

  useEffect(() => {
    loadPage();
  }, [eventId]);

  async function loadPage() {
    setLoading(true);
    setError("");

    const token = new URLSearchParams(window.location.search).get(
      "token"
    );

    if (!token) {
      setError("Organiser token is missing.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_official_event_organiser_review_data",
        {
          p_event_id: eventId,
          p_token: token,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      const result = data as ReviewData;

      if (!result?.event) {
        throw new Error("Event not found");
      }

      setValid(true);

      setEventTitle(result.event.title || "Official Event");

      setEventTicketUrl(result.event.ticket_url || "");

    
      setAcceptTemplate(
        (result.event.whatsapp_accept_message || "").trim() ||
          DEFAULT_ACCEPT_MESSAGE
      );

      setRejectTemplate(
        (result.event.whatsapp_reject_message || "").trim() ||
          DEFAULT_REJECT_MESSAGE
      );

      setQuestions(result.questions || []);
      setApplications(result.applications || []);
    } catch (err) {
      console.error("Organiser review loading failed:", err);

      setValid(false);

      setError(
        "This organiser link is invalid or expired."
      );
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------
  // ACCEPT
  // -----------------------------------------

  async function handleAccept(application: Application) {
    const token = new URLSearchParams(window.location.search).get(
      "token"
    );

    if (!token) {
      alert("Organiser token is missing.");
      return;
    }

    const confirmed = window.confirm(
      `Accept ${
        application.applicant_name || "this applicant"
      }?`
    );

    if (!confirmed) return;

    setActionLoading(application.id);

    try {
      const { data, error } = await supabase.rpc(
        "organiser_accept_official_event_application",
        {
          p_event_id: eventId,
          p_token: token,
          p_application_id: application.id,
        }
      );

      if (error) throw error;

      const result = data as any;

      const updated =
        result?.application as Application;

      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? {
                ...item,
                ...updated,
                applicant_name:
                  item.applicant_name,
                applicant_phone:
                  item.applicant_phone,
                payment_status:
                  item.payment_status,
              }
            : item
        )
      );

      setOpenId(application.id);

      const merged: Application = {
        ...application,
        ...(updated || {}),
        applicant_name: application.applicant_name,
        applicant_phone: application.applicant_phone,
      };

      const opened = launchWhatsApp(merged, "accept");

      if (!opened) {
        alert(
          "Application accepted. WhatsApp could not be opened because this applicant has no valid phone number."
        );
      }
    } catch (err: any) {
      console.error("Accept failed:", err);

      alert(
        err?.message ||
          "Could not accept this application."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // -----------------------------------------
  // REJECT
  // -----------------------------------------

  async function handleReject(application: Application) {
    const token = new URLSearchParams(window.location.search).get(
      "token"
    );

    if (!token) {
      alert("Organiser token is missing.");
      return;
    }

    const reason = window.prompt(
      "Enter rejection reason:"
    );

    if (reason === null) return;

    if (!reason.trim()) {
      alert("Please enter a rejection reason.");
      return;
    }

    const confirmed = window.confirm(
      `Reject ${
        application.applicant_name || "this applicant"
      }?`
    );

    if (!confirmed) return;

    setActionLoading(application.id);

    try {
      const { data, error } = await supabase.rpc(
        "organiser_reject_official_event_application",
        {
          p_event_id: eventId,
          p_token: token,
          p_application_id: application.id,
          p_rejection_reason: reason.trim(),
        }
      );

      if (error) throw error;

      const result = data as any;

      const updated =
        result?.application as Application;

      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? {
                ...item,
                ...updated,
                applicant_name:
                  item.applicant_name,
                applicant_phone:
                  item.applicant_phone,
                payment_status:
                  item.payment_status,
              }
            : item
        )
      );

      setOpenId(application.id);

      const merged: Application = {
        ...application,
        ...(updated || {}),
        rejection_reason: reason.trim(),
        applicant_name: application.applicant_name,
        applicant_phone: application.applicant_phone,
      };

      const opened = launchWhatsApp(merged, "reject");

      if (!opened) {
        alert(
          "Application rejected. WhatsApp could not be opened because this applicant has no valid phone number."
        );
      }
    } catch (err: any) {
      console.error("Reject failed:", err);

      alert(
        err?.message ||
          "Could not reject this application."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // -----------------------------------------
  // WHATSAPP
  // -----------------------------------------

function buildMessage(
  application: Application,
  kind: "accept" | "reject"
) {
  const template =
    kind === "accept" ? acceptTemplate : rejectTemplate;

  return renderWhatsAppMessage(template, {
    name: application.applicant_name,
    event_name: eventTitle,
    payment_deadline: application.payment_deadline_at
      ? new Date(
          application.payment_deadline_at
        ).toLocaleString("en-IN")
      : "",
    payment_link: eventTicketUrl,
    reason: application.rejection_reason,
  });
}

/** Opens WhatsApp straight away with the message prefilled. */
function launchWhatsApp(
  application: Application,
  kind: "accept" | "reject"
) {
  const phone = cleanWhatsAppPhone(
    application.applicant_phone
  );

  const message = buildMessage(application, kind);

  if (!phone) {
    setWhatsappApplication(application);
    setWhatsappMessage(message);
    setWhatsappOpen(true);
    return false;
  }

  window.open(
    whatsappLink(phone, message),
    "_blank",
    "noopener,noreferrer"
  );

  return true;
}

function openWhatsApp(application: Application) {
  const kind =
    application.status === "rejected" ? "reject" : "accept";

  setWhatsappApplication(application);
  setWhatsappMessage(buildMessage(application, kind));
  setWhatsappOpen(true);
}

function sendWhatsAppMessage() {
  const phone = cleanWhatsAppPhone(
    whatsappApplication?.applicant_phone
  );

  if (!phone) {
    alert(
      "WhatsApp could not be opened: this applicant has no valid phone number."
    );
    return;
  }

  window.open(
    whatsappLink(phone, whatsappMessage),
    "_blank",
    "noopener,noreferrer"
  );

  setWhatsappOpen(false);
}

  // -----------------------------------------
  // LOADING
  // -----------------------------------------

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

  // -----------------------------------------
  // INVALID
  // -----------------------------------------

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
            "This organiser link is invalid or has expired."}
        </p>
      </div>
    );
  }

  // -----------------------------------------
  // PAGE
  // -----------------------------------------

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-16 pt-8">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Gathr
        </p>

        <h1 className="mt-1 text-2xl font-extrabold">
          Organiser Review
        </h1>

        <p className="mt-1 text-sm font-semibold">
          {eventTitle}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          Review and manage event applications.
        </p>
      </header>

      {/* COUNT */}

      <div className="mb-5 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          Applications
        </p>

        <p className="mt-1 text-2xl font-extrabold">
          {applications.length}
        </p>
      </div>

      {/* LIST */}

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
          {applications.map((application) => {
            const open =
              openId === application.id;

            const isPending =
              application.status === "pending";

            const isAccepted =
              application.status === "payment_pending" ||
              application.status === "confirmed";

            const isRejected =
              application.status === "rejected";

            const isProcessing =
              actionLoading === application.id;

            return (
              <div
                key={application.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* HEADER */}

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
                          "Gathr User"}
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

                                <p className="mt-2 whitespace-pre-wrap text-sm">
                                  {formatAnswer(answer)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* REJECTION */}

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

                    {/* ACTIONS */}

                    <div className="mt-5 space-y-2">
                      {isPending && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() =>
                              handleAccept(application)
                            }
                            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}

                            Accept
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() =>
                              handleReject(application)
                            }
                            className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}

                            Reject
                          </button>
                        </div>
                      )}

                      {(isAccepted || isRejected) && (
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsApp(application)
                          }
                          disabled={
                            !application.applicant_phone
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <MessageCircle className="h-4 w-4" />

                          {isAccepted
                            ? "WhatsApp Payment Message"
                            : "WhatsApp Rejection Message"}
                        </button>
                      )}

                      {(isAccepted || isRejected) &&
                        !application.applicant_phone && (
                          <p className="text-center text-xs text-muted-foreground">
                            Applicant phone number is not
                            available.
                          </p>
                        )}
                    </div>

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
      <WhatsAppMessageDialog
        open={whatsappOpen}
        application={whatsappApplication}
        message={whatsappMessage}
        onMessageChange={setWhatsappMessage}
        onSend={sendWhatsAppMessage}
        onClose={() => setWhatsappOpen(false)}
      />
    </div>
  );
}




/* ---------------------------------------------
   STATUS
--------------------------------------------- */

function getDisplayStatus(
  application: Application
) {
  if (
    application.payment_status === "APPROVED" ||
    application.status === "confirmed"
  ) {
    return "Payment confirmed";
  }

  if (
    application.status === "payment_pending"
  ) {
    return "Waiting for payment";
  }

  if (application.status === "rejected") {
    return "Application rejected";
  }

  return "Application pending";
}

function getPaymentLabel(
  application: Application
) {
  if (
    application.payment_status === "APPROVED" ||
    application.status === "confirmed"
  ) {
    return "Payment Confirmed";
  }

  if (
    application.status === "payment_pending"
  ) {
    return "Payment Pending";
  }

  if (application.payment_status) {
    return application.payment_status;
  }

  return "Not paid";
}

/* ---------------------------------------------
   ANSWER
--------------------------------------------- */

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

  if (
    typeof answer === "string" &&
    answer.trim() === ""
  ) {
    return "No answer provided";
  }

  return String(answer);
}

/* ---------------------------------------------
   STATUS BADGE
--------------------------------------------- */

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

/* ---------------------------------------------
   PAYMENT ICON
--------------------------------------------- */

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
function WhatsAppMessageDialog({
  open,
  application,
  message,
  onMessageChange,
  onSend,
  onClose,
}: {
  open: boolean;
  application: Application | null;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  if (!open || !application) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-background p-5 shadow-xl">
        <h2 className="text-lg font-extrabold">
          WhatsApp Message
        </h2>

        <p className="mt-1 text-xs text-muted-foreground">
          Message edit kar sakte ho before sending.
        </p>

        <textarea
          value={message}
          onChange={(e) =>
            onMessageChange(e.target.value)
          }
          className="mt-4 min-h-[220px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-3 text-sm font-bold"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSend}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" />
            Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
