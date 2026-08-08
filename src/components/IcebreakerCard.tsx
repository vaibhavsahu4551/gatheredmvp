import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Send, Check } from "lucide-react";
import { toast } from "sonner";
import { getTodayIcebreaker, answerIcebreaker, type TodayIcebreaker } from "@/lib/icebreakers";

export function IcebreakerCard({ city, onAnswered }: { city?: string; onAnswered?: () => void }) {
  const [ib, setIb] = useState<TodayIcebreaker | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getTodayIcebreaker().then(setIb).catch(() => {}); }, []);

  if (!ib) return null;
  const answered = !!ib.my_post_id;

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await answerIcebreaker(ib.prompt_id, ib.day, text, city ?? "");
      setText("");
      setIb(await getTodayIcebreaker());
      toast.success("Answer posted");
      onAnswered?.();
    } catch (e: any) {
      toast.error(e.message ?? "Could not post your answer");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-gradient-brand-soft p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gradient-brand">
        <Sparkles className="h-3.5 w-3.5" /> Daily icebreaker
      </div>
      <div className="mt-1.5 text-[15px] font-semibold leading-snug">{ib.prompt}</div>

      {answered ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-600" /> You answered today
          </span>
          <Link to="/icebreaker" className="text-[13px] font-semibold text-primary">
            See {ib.answer_count} answer{ib.answer_count === 1 ? "" : "s"} →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Your answer…"
              maxLength={280}
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm"
            />
            <button
              onClick={submit}
              disabled={busy || !text.trim()}
              className="rounded-full bg-gradient-brand text-white px-4 text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1"
            >
              <Send className="h-3.5 w-3.5" /> Post
            </button>
          </div>
          {ib.answer_count > 0 && (
            <Link to="/icebreaker" className="mt-2 inline-block text-[12px] font-semibold text-primary">
              {ib.answer_count} answered so far →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
