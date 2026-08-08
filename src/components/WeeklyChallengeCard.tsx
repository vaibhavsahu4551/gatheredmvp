import { useEffect, useState } from "react";
import { Trophy, Gift, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { getWeeklyChallenge, claimWeeklyChallenge, rewardLabel, type WeeklyChallenge } from "@/lib/challenges";

export function WeeklyChallengeCard() {
  const [c, setC] = useState<WeeklyChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  useEffect(() => { getWeeklyChallenge().then(setC).catch(() => {}); }, []);
  if (!c) return null;

  const pct = Math.min(100, Math.round((c.progress / Math.max(c.goal_target, 1)) * 100));
  const ready = c.progress >= c.goal_target && !c.completed;

  const claim = async () => {
    setBusy(true);
    try {
      const detail = await claimWeeklyChallenge();
      setC(await getWeeklyChallenge());
      setCelebrate(detail);
      toast.success(`Challenge complete — ${detail}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not claim reward");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> This week's challenge
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gradient-brand">
            <Gift className="h-3 w-3" /> {rewardLabel(c)}
          </span>
        </div>
        <div className="mt-1.5 text-[15px] font-semibold leading-snug">{c.title}</div>
        {c.description && <div className="text-[12px] text-muted-foreground mt-0.5">{c.description}</div>}

        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">{c.progress} / {c.goal_target}</span>
          {c.completed ? (
            <span className="text-[12px] font-semibold text-emerald-600">Reward claimed 🎉</span>
          ) : ready ? (
            <button
              onClick={claim}
              disabled={busy}
              className="rounded-full bg-gradient-brand text-white text-[12px] font-semibold px-3.5 py-1.5 disabled:opacity-60"
            >
              Claim reward
            </button>
          ) : (
            <span className="text-[12px] text-muted-foreground">Resets Monday</span>
          )}
        </div>
      </div>

      {celebrate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setCelebrate(null)}>
          <div className="rounded-3xl bg-card p-6 text-center max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
            <PartyPopper className="h-10 w-10 mx-auto text-gradient-brand" />
            <div className="mt-3 text-lg font-semibold">Challenge complete!</div>
            <div className="mt-1 text-sm text-muted-foreground">You earned: {celebrate}</div>
            <button onClick={() => setCelebrate(null)} className="mt-4 w-full rounded-full bg-gradient-brand text-white py-2.5 text-sm font-semibold">
              Nice
            </button>
          </div>
        </div>
      )}
    </>
  );
}
