import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Gift, Share2, Sparkles, Ticket, Rocket, BadgeCheck } from "lucide-react";
import {
  getMyRewards, getRewardsConfig, listMyPointsTx, listMyBadges, redeemReward, referralLink,
  type MyRewards, type PointsTx, type RewardsConfig,
} from "@/lib/rewards";

export const Route = createFileRoute("/_authenticated/_app/rewards/")({
  head: () => ({
    meta: [
      { title: "Rewards & invites — Gathr" },
      { name: "description", content: "Invite friends to Gathr, earn points and redeem them for premium trials, event boosts and badges." },
      { property: "og:title", content: "Rewards & invites — Gathr" },
      { property: "og:description", content: "Invite friends, earn points, redeem rewards on Gathr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rewards,
});

function Rewards() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MyRewards | null>(null);
  const [cfg, setCfg] = useState<RewardsConfig | null>(null);
  const [tx, setTx] = useState<PointsTx[]>([]);
  const [badges, setBadges] = useState<{ badge: string; created_at: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [r, c, t, b] = await Promise.all([getMyRewards(), getRewardsConfig(), listMyPointsTx(), listMyBadges()]);
    setMe(r); setCfg(c); setTx(t); setBadges(b);
  };
  useEffect(() => { load().catch((e) => toast.error(e.message ?? "Failed to load rewards")); }, []);

  const link = me?.referral_code ? referralLink(me.referral_code) : "";

  const share = async () => {
    if (!link) return;
    const text = `Join me on Gathr — real meetups with people who show up. Use my code ${me?.referral_code}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Join me on Gathr", text, url: link }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const doRedeem = async (kind: "trial" | "boost" | "badge") => {
    setBusy(kind);
    try {
      await redeemReward(kind);
      toast.success("Redeemed!");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Couldn't redeem"); }
    finally { setBusy(null); }
  };

  const points = me?.points ?? 0;

  const rewards = cfg ? [
    { kind: "trial" as const, icon: Ticket, title: `${cfg.trial_days} days of Premium`, sub: "Extends your premium access", cost: cfg.cost_trial_days },
    { kind: "boost" as const, icon: Rocket, title: "Boost an event", sub: "Pushes your next event to the top", cost: cfg.cost_boost },
    { kind: "badge" as const, icon: BadgeCheck, title: `${cfg.badge_name} badge`, sub: "A badge on your profile", cost: cfg.cost_badge },
  ] : [];

  return (
    <div className="pb-24">
      <header className="px-5 pt-8 pb-3 flex items-center gap-3">
        <button onClick={() => history.back()} aria-label="Back" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">Rewards</h1>
      </header>

      <div className="px-5">
        <div className="rounded-3xl p-5 text-white shadow-lg" style={{ backgroundImage: "var(--gradient-brand)" }}>
          <div className="text-xs font-semibold tracking-widest opacity-85">YOUR POINTS</div>
          <div className="mt-1 text-4xl font-black">{points}</div>
          <div className="mt-1 text-[13px] opacity-90">
            {me?.referral_count ?? 0} friend{(me?.referral_count ?? 0) === 1 ? "" : "s"} joined with your code
          </div>
        </div>

        <section className="mt-6">
          <div className="text-xs font-semibold text-muted-foreground">INVITE FRIENDS</div>
          <div className="mt-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Earn <span className="font-semibold text-foreground">{cfg?.referral_points ?? 0} points</span> when a friend signs up with your code and finishes their profile
              {cfg?.welcome_points ? <> — they get {cfg.welcome_points} points too.</> : "."}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-muted px-3 py-2.5 font-mono text-base font-bold tracking-widest text-center">
                {me?.referral_code ?? "—"}
              </div>
              <button
                onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Link copied"); }}
                className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center" aria-label="Copy invite link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <button onClick={share} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand text-white py-2.5 text-sm font-semibold">
              <Share2 className="h-4 w-4" /> Share invite
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="text-xs font-semibold text-muted-foreground">REDEEM POINTS</div>
          <div className="mt-2 space-y-2">
            {rewards.map((r) => {
              const Icon = r.icon;
              const can = points >= r.cost;
              return (
                <div key={r.kind} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center"><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.sub} · {r.cost} pts</div>
                  </div>
                  <button
                    disabled={!can || busy === r.kind}
                    onClick={() => doRedeem(r.kind)}
                    className="rounded-full px-4 py-2 text-xs font-semibold bg-foreground text-background disabled:opacity-40"
                  >
                    {busy === r.kind ? "…" : "Redeem"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {badges.length > 0 && (
          <section className="mt-6">
            <div className="text-xs font-semibold text-muted-foreground">YOUR BADGES</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b.badge} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[13px] font-medium">
                  <Sparkles className="h-3.5 w-3.5" /> {b.badge}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <div className="text-xs font-semibold text-muted-foreground">HISTORY</div>
          {tx.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              <Gift className="mx-auto h-5 w-5 mb-2" /> No points activity yet.
            </div>
          ) : (
            <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
              {tx.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.reason ?? t.kind}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className={`text-sm font-bold ${t.amount >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {t.amount >= 0 ? "+" : ""}{t.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
