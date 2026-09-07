import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  MessageCircle,
  Ticket,
} from "lucide-react";
import {
  defaultBookingWhatsapp,
  getOfficialEvent,
  priceLabel,
  resolveOfficialMedia,
  whatsappBookingLink,
  type OfficialEvent,
} from "@/lib/official-events";
import { listPasses, passRemaining, passSoldOut, type OfficialPass } from "@/lib/official-passes";
import {
  getApplicationQuestions,
  getMyApplication,
  submitOfficialApplication,
  type OfficialApplication,
  type OfficialApplicationQuestion,
} from "@/lib/official-applications";
export const Route = createFileRoute("/_authenticated/_app/official/$officialId/")({
  component: OfficialEventDetail,
});


function OfficialEventDetail() {
  const { officialId } = Route.useParams();
  const [e, setE] = useState<OfficialEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [cover, setCover] = useState("");
  const [logo, setLogo] = useState("");
  const [fallbackNum, setFallbackNum] = useState("");
  const [passes, setPasses] = useState<OfficialPass[]>([]);
  const [application, setApplication] =
  useState<OfficialApplication | null>(null);

const [questions, setQuestions] =
  useState<OfficialApplicationQuestion[]>([]);

const [answers, setAnswers] =
  useState<Record<string, string | string[]>>({});

const [showApplicationForm, setShowApplicationForm] =
  useState(false);

const [applicationLoading, setApplicationLoading] =
  useState(false);

const [applicationSubmitting, setApplicationSubmitting] =
  useState(false);

const [applicationError, setApplicationError] =
  useState("");
  useEffect(() => {
    let alive = true;
    getOfficialEvent(officialId)
      .then(async (row) => {
        if (!alive) return;
        setE(row);
        setLoading(false);
        if (row) {
          resolveOfficialMedia(row.cover_url).then((u) => alive && setCover(u)).catch(() => {});
          resolveOfficialMedia(row.organizer_logo).then((u) => alive && setLogo(u)).catch(() => {});
        }
      })
      .catch(() => alive && setLoading(false));
    listPasses(officialId, { activeOnly: true }).then((p) => alive && setPasses(p)).catch(() => {});
    getApplicationQuestions(officialId)
  .then((q) => alive && setQuestions(q))
  .catch(() => {});

getMyApplication(officialId)
  .then((a) => alive && setApplication(a))
  .catch(() => {});
    defaultBookingWhatsapp().then((n) => alive && setFallbackNum(n));
    return () => { alive = false; };
  }, [officialId]);

async function handleSubmitApplication() {
  if (!e) return;

  setApplicationError("");

  for (const q of questions) {
    if (!q.is_required) continue;

    const answer = answers[q.id];

    if (
      answer === undefined ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0)
    ) {
      setApplicationError(
        `Please answer: ${q.question_text}`
      );
      return;
    }
  }

  try {
    setApplicationSubmitting(true);

    const submitted = await submitOfficialApplication({
      eventId: e.id,
      answers,
    });

    setApplication(submitted);
    setShowApplicationForm(false);
  } catch (error: any) {
    setApplicationError(
      error?.message || "Unable to submit application."
    );
  } finally {
    setApplicationSubmitting(false);
  }
}
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!e) return <div className="p-6 text-sm text-muted-foreground">This event is no longer available.</div>;

  const when = new Date(e.starts_at).toLocaleString([], {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  const wa = whatsappBookingLink(e, fallbackNum);

  return (
    <div className="pb-28">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
        <Link to="/home" className="absolute left-4 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute inset-x-4 bottom-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              <BadgeCheck className="h-3 w-3" /> Official Event
            </span>
            {e.is_featured && (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950">Featured</span>
            )}
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">{e.category}</span>
          </div>
          <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-white">{e.title}</h1>
        </div>
      </div>

      <div className="space-y-4 px-5 pt-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
          <Row icon={CalendarDays} label={when} />
          <Row icon={MapPin} label={[e.venue, e.city].filter(Boolean).join(", ") || "Venue TBA"} />
          {priceLabel(e) && <Row icon={Ticket} label={priceLabel(e)} />}
          {e.ends_at && <Row icon={CalendarDays} label={`Ends ${new Date(e.ends_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`} />}
          {e.contact_phone && <Row icon={MessageCircle} label={e.contact_phone} />}
        </div>
      {e.booking_type === "selection" && (
  <section className="rounded-2xl border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">
      Entry by Selection
    </h2>

    {!application && !showApplicationForm && (
      <>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Apply for this event by answering a few questions.
          Your application will be reviewed by the organiser.
        </p>

        <button
          type="button"
          onClick={async () => {
            setApplicationLoading(true);
            setApplicationError("");

            try {
              const q = await getApplicationQuestions(officialId);
              setQuestions(q);
              setShowApplicationForm(true);
            } catch (error: any) {
              setApplicationError(
                error?.message || "Unable to load application."
              );
            } finally {
              setApplicationLoading(false);
            }
          }}
          disabled={applicationLoading}
          className="mt-3 w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {applicationLoading ? "Loading…" : "Apply Now"}
        </button>
      </>
    )}

    {application?.status === "pending" && (
      <div className="mt-3 rounded-xl bg-muted/60 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4" />
          Application under review
        </div>

        <p className="mt-1 text-[12px] text-muted-foreground">
          Your application has been submitted. You’ll be able to
          continue once the organiser reviews it.
        </p>
      </div>
    )}

    {application?.status === "rejected" && (
      <div className="mt-3 rounded-xl bg-muted/60 p-3">
        <div className="text-sm font-semibold">
          Application Rejected
        </div>

        {application.rejection_reason && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Reason: {application.rejection_reason}
          </p>
        )}
      </div>
    )}

    {(application?.status === "accepted" ||
      application?.status === "payment_pending") && (
      <div className="mt-3 rounded-xl border border-border p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          Application Accepted
        </div>

        <p className="mt-1 text-[12px] text-muted-foreground">
          Your application has been accepted. Complete your payment
          before the deadline to confirm your spot.
        </p>
      </div>
    )}

    {application?.status === "confirmed" && (
      <div className="mt-3 rounded-xl border border-border p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          You're confirmed
        </div>

        <p className="mt-1 text-[12px] text-muted-foreground">
          Your spot for this event is confirmed.
        </p>
      </div>
    )}

    {showApplicationForm && !application && (
      <div className="mt-4 space-y-4">
        {questions.map((q) => (
          <div key={q.id}>
            <label className="text-sm font-medium">
              {q.question_text}
              {q.is_required && (
                <span className="text-destructive"> *</span>
              )}
            </label>

            {q.question_type === "text" && (
              <input
                value={
                  typeof answers[q.id] === "string"
                    ? answers[q.id] as string
                    : ""
                }
                onChange={(ev) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [q.id]: ev.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
              />
            )}

            {q.question_type === "textarea" && (
              <textarea
                value={
                  typeof answers[q.id] === "string"
                    ? answers[q.id] as string
                    : ""
                }
                onChange={(ev) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [q.id]: ev.target.value,
                  }))
                }
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
              />
            )}

            {q.question_type === "single_choice" && (
              <div className="mt-2 space-y-2">
                {(q.choices ?? []).map((choice) => (
                  <label
                    key={choice}
                    className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === choice}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: choice,
                        }))
                      }
                    />
                    {choice}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === "multiple_choice" && (
              <div className="mt-2 space-y-2">
                {(q.choices ?? []).map((choice) => {
                  const selected = Array.isArray(answers[q.id])
                    ? answers[q.id].includes(choice)
                    : false;

                  return (
                    <label
                      key={choice}
                      className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(ev) => {
                          const raw = answers[q.id];
                          const current: string[] = Array.isArray(raw)
                            ? raw
                            : [];

                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: ev.target.checked
                              ? [...current, choice]
                              : current.filter(
                                  (item: string) => item !== choice
                                ),
                          }));
                        }}
                      />
                      {choice}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {applicationError && (
          <div className="rounded-xl bg-destructive/10 p-3 text-[12px] text-destructive">
            {applicationError}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmitApplication}
          disabled={applicationSubmitting}
          className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {applicationSubmitting
            ? "Submitting…"
            : "Submit Application"}
        </button>

        <button
          type="button"
          onClick={() => setShowApplicationForm(false)}
          className="w-full py-2 text-sm font-semibold text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    )}
  </section>
)}
        {passes.length > 0 && (
          <section id="passes" className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Available passes</h2>
            <div className="mt-2 space-y-2">
              {passes.map((p) => {
                const out = passSoldOut(p);
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{p.name}</div>
                      <div className="text-[12px] text-muted-foreground">
                        ₹{Number(p.price).toLocaleString("en-IN")}
                        {p.total_quantity > 0 && ` · ${passRemaining(p)} left`}
                      </div>
                      {p.description && <p className="mt-0.5 text-[11px] text-muted-foreground">{p.description}</p>}
                    </div>
                    {out ? (
                      <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground">Sold out</span>
                    ) : (
                      <Link
                        to="/official/$officialId/checkout"
                        params={{ officialId }}
                        search={{ passId: p.id, qty: 1 }}
                        className="rounded-full bg-gradient-brand px-4 py-2 text-[12px] font-bold text-white"
                      >
                        Select
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <Link to="/passes" className="mt-2 inline-block text-[11px] font-semibold text-primary underline">My passes</Link>
          </section>
        )}


        {(e.pass_info || e.pass_price != null || e.pass_quantity != null) && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Passes</h2>
            {e.pass_price != null && (
              <div className="mt-1 text-[15px] font-extrabold">₹{Number(e.pass_price).toLocaleString("en-IN")} <span className="text-xs font-medium text-muted-foreground">per pass</span></div>
            )}
            {e.pass_quantity != null && (
              <div className="text-[12px] text-muted-foreground">{e.pass_quantity} passes available</div>
            )}
            {e.pass_info && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{e.pass_info}</p>}
          </section>
        )}

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          {logo ? (
            <img src={logo} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-bold">
              {(e.organizer_name || "G").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Organized by</div>
            <div className="truncate text-sm font-semibold">{e.organizer_name || "Gathr Partner"}</div>
          </div>
        </div>

        {e.description && (
          <section>
            <h2 className="text-sm font-semibold">About this event</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{e.description}</p>
          </section>
        )}

        {e.instructions && (
          <section>
            <h2 className="text-sm font-semibold">Important information</h2>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{e.instructions}</p>
          </section>
        )}

        {e.terms && (
          <section>
            <h2 className="text-sm font-semibold">Terms & information</h2>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{e.terms}</p>
          </section>
        )}

        {e.ticket_url && (
          <a
            href={e.ticket_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline"
          >
            Book tickets online <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {wa && passes.length === 0 && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-[15px] font-bold text-white shadow-sm active:scale-[0.99]"
          >
            <MessageCircle className="h-5 w-5" /> Get Pass
          </a>
        )}
      </div>

      {(passes.length > 0 || wa) && (
        <div className="fixed inset-x-0 bottom-16 z-50 border-t border-border bg-background/95 p-3 pb-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            {passes.length > 0 ? (
              <a
                href="#passes"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand py-3.5 text-[15px] font-bold text-white shadow-sm active:scale-[0.99]"
              >
                <Ticket className="h-5 w-5" /> Get Pass
              </a>
            ) : (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-[15px] font-bold text-white shadow-sm active:scale-[0.99]"
              >
                <MessageCircle className="h-5 w-5" /> Get Pass
              </a>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
