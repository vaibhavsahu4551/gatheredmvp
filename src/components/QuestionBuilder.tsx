import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  QUESTION_TYPE_LABELS,
  emptyQuestion,
  type ApplicationQuestion,
  type QuestionType,
} from "@/lib/applications";

const inputCls =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function QuestionBuilder({
  questions,
  onChange,
}: {
  questions: ApplicationQuestion[];
  onChange: (q: ApplicationQuestion[]) => void;
}) {
  const update = (i: number, patch: Partial<ApplicationQuestion>) =>
    onChange(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((q, idx) => ({ ...q, sort_order: idx })));
  };

  const remove = (i: number) =>
    onChange(questions.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, sort_order: idx })));

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={i} className="rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground">Question {i + 1}</div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center" aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center" aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(i)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-destructive" aria-label="Remove question">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <input
            value={q.question_text}
            onChange={(e) => update(i, { question_text: e.target.value })}
            placeholder="What should applicants tell you?"
            className={inputCls}
          />

          <div className="flex flex-wrap gap-2">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update(i, { question_type: t, choices: t === "multiple_choice" ? (q.choices.length ? q.choices : ["", ""]) : [] })}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition ${
                  q.question_type === t ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {QUESTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {q.question_type === "multiple_choice" && (
            <div className="space-y-2">
              {q.choices.map((c, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    value={c}
                    onChange={(e) => update(i, { choices: q.choices.map((x, xi) => (xi === ci ? e.target.value : x)) })}
                    placeholder={`Option ${ci + 1}`}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => update(i, { choices: q.choices.filter((_, xi) => xi !== ci) })}
                    className="h-9 w-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-destructive"
                    aria-label="Remove option"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update(i, { choices: [...q.choices, ""] })}
                className="text-[13px] font-medium underline text-muted-foreground"
              >
                Add option
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={q.is_required}
              onChange={(e) => update(i, { is_required: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Required
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...questions, emptyQuestion(questions.length)])}
        className="w-full rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" /> Add question
      </button>
    </div>
  );
}
