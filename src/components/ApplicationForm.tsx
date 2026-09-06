import { useState } from "react";
import { toast } from "sonner";
import { submitApplication, type ApplicationQuestion } from "@/lib/applications";

export function ApplicationForm({
  eventId,
  questions,
  onClose,
  onSubmitted,
}: {
  eventId: string;
  questions: ApplicationQuestion[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setValue = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }));

  const submit = async () => {
    for (const q of questions) {
      if (q.is_required && !values[q.id!]?.trim()) {
        toast.error(Please answer: ${q.question_text});
        return;
      }
    }
    setSubmitting(true);
    try {
      const answers = questions.map((q) => ({
        question_id: q.id!,
        question_text: q.question_text,
        answer: (values[q.id!] ?? "").trim(),
      }));
      await submitApplication(eventId, answers);
      toast.success("Application sent");
      onSubmitted();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card p-5">
        <h2 className="text-lg font-semibold">Apply to join</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The host reviews applications before confirming your spot.
        </p>
        <div className="mt-4 space-y-4">
          {questions.map((q) => (
            <div key={q.id}>
              <label className="text-sm font-medium">
                {q.question_text}
                {q.is_required && <span className="text-destructive"> *</span>}
              </label>
              {q.question_type === "multiple_choice" ? (
                <div className="mt-2 space-y-1.5">
                  {q.choices.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 text-sm rounded-xl border border-border px-3 py-2"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={values[q.id!] === c}
                        onChange={() => setValue(q.id!, c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              ) : q.question_type === "text" ? (
                <textarea
                  value={values[q.id!] ?? ""}
                  onChange={(e) => setValue(q.id!, e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                />
              ) : (
                <input
                  value={values[q.id!] ?? ""}
                  onChange={(e) => setValue(q.id!, e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-border py-3 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Submit application"}
          </button>
        </div>
      </div>
    </div>
  );
}
