import { invalidateEntitlements } from "@/lib/entitlements";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  getMySubscriptionState,
  type SubscriptionState,
} from "@/lib/subscription";
import { PREMIUM_PLANS, perMonth, planPerks, type PlanId } from "@/lib/plans";
import { createPremiumOrder, verifyPremiumPayment } from "@/lib/razorpay.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionsEnabled } from "@/hooks/useSubscriptionsEnabled";
import { getAppSettingsCached } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/_app/premium")({
  component: PremiumGuard,
});

/** When the admin subscription toggle is OFF there is no paywall — send users home. */
function PremiumGuard() {
  const navigate = useNavigate();
  const enabled = useSubscriptionsEnabled();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    getAppSettingsCached().then((s) => {
      if (!s.subscription_enabled) navigate({ to: "/home" });
      setChecked(true);
    });
  }, [navigate]);
  if (!checked || !enabled) return null;
  return <PremiumScreen />;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const FEATURES: { label: string; free: boolean; premium: boolean }[] = [
  { label: "Discover events near you", free: true, premium: true },
  { label: "Join public events", free: true, premium: true },
  { label: "Post to the community feed", free: true, premium: true },
  { label: "Direct messages with Linkups", free: true, premium: true },
  { label: "Unlimited events & joins", free: false, premium: true },
  { label: "Priority verification", free: false, premium: true },
  { label: "Full attendee preview", free: false, premium: true },
  { label: "Boosted event listing", free: false, premium: true },
  { label: "Advanced filters & search", free: false, premium: true },
  { label: "1:1 DMs before events", free: false, premium: true },
  { label: "Pride section extras", free: false, premium: true },
  { label: "Host history visibility", free: false, premium: true },
  { label: "Verified Host/Member badge", free: false, premium: true },
];

function PremiumScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [selected, setSelected] = useState<PlanId>("m12");
  const [busy, setBusy] = useState(false);
  const createOrder = useServerFn(createPremiumOrder);
  const verifyPayment = useServerFn(verifyPremiumPayment);

  useEffect(() => {
    getMySubscriptionState().then(setState);
    loadRazorpay();
  }, []);

  const plan = PREMIUM_PLANS.find((p) => p.id === selected)!;

  const onSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Couldn't load Razorpay. Check your connection.");

      const order = await createOrder({ data: { planId: plan.id } });
      const { data: { user } } = await supabase.auth.getUser();
      const { data: rows } = await (supabase as any).rpc("get_my_profile");
      const profile = Array.isArray(rows) ? rows[0] : rows;

      const rzp = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: "INR",
        name: "Gathr Premium",
        description: `${plan.label} · ₹${plan.priceInr}`,
        theme: { color: "#ec4899" },
        prefill: {
          name: (profile as any)?.full_name ?? "",
          contact: (profile as any)?.phone ?? "",
          email: user?.email ?? "",
        },
        handler: async (resp: any) => {
          try {
            const result = await verifyPayment({
              data: {
                planId: plan.id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              },
            });
            invalidateEntitlements();
            const perks = planPerks(plan);
            toast.success(
              `Premium activated for ${plan.label}` +
                (perks.length && !(result as any).alreadyProcessed ? ` · ${perks.join(" · ")}` : ""),
            );
            const next = await getMySubscriptionState();
            setState(next);
            navigate({ to: "/subscription" });
          } catch (e: any) {
            toast.error(e?.message ?? "We couldn't confirm that payment.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start checkout");
      setBusy(false);
    }
  };

  const isPremium = state?.tier === "premium";

  return (
    <div>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <button
          onClick={() => (history.length > 1 ? history.back() : navigate({ to: "/profile" }))}
          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Gathr Premium</h1>
      </header>

      <div className="px-5">
        <div className="rounded-3xl bg-gradient-brand text-white p-6 shadow-elevated">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div className="text-sm font-semibold uppercase tracking-wider opacity-90">Premium</div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <div className="text-4xl font-bold">₹{perMonth(plan)}</div>
            <div className="text-sm opacity-90">/ month</div>
          </div>
          <p className="mt-2 text-sm opacity-95">
            Pay once for {plan.label.toLowerCase()} — no surprise auto-renewal.
            We'll remind you to resubscribe when it ends.
          </p>
        </div>

        {state && !state.subscriptionsEnabled && (
          <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-3 text-[13px]">
            Premium is currently free for everyone while we finalise pricing —
            you already have full access.
          </div>
        )}

        <div className="mt-6 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Choose your plan
          </div>
          {PREMIUM_PLANS.map((p) => {
            const active = p.id === selected;
            const perks = planPerks(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                aria-pressed={active}
                className={`relative w-full text-left rounded-2xl border p-4 transition ${
                  active
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                {p.bestValue && (
                  <span className="absolute -top-2 right-4 rounded-full bg-gradient-brand text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-glow">
                    Best value
                  </span>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[15px] font-semibold">{p.label}</div>
                  <div className="text-lg font-bold">₹{p.priceInr}</div>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {p.months > 1 ? `Save vs monthly` : "Starter plan"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ₹{perMonth(p)}/month
                  </div>
                </div>
                {perks.length > 0 && (
                  <div className="mt-2 text-[12px] font-medium bg-gradient-brand bg-clip-text text-transparent">
                    {perks.join(" · ")}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_60px_80px] text-xs font-semibold uppercase tracking-wider bg-muted/60 px-4 py-3">
            <div>Feature</div>
            <div className="text-center">Free</div>
            <div className="text-center">Premium</div>
          </div>
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="grid grid-cols-[1fr_60px_80px] items-center px-4 py-3 border-t border-border text-sm"
            >
              <div>{f.label}</div>
              <div className="flex justify-center">
                {f.free ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/60" />
                )}
              </div>
              <div className="flex justify-center">
                {f.premium ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/60" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pb-24">
          <button
            disabled={busy}
            onClick={onSubscribe}
            className="w-full rounded-full bg-gradient-brand text-white py-3.5 text-sm font-semibold shadow-glow disabled:opacity-60"
          >
            {busy
              ? "Opening checkout…"
              : `${isPremium ? "Extend" : "Get Premium"} · ${plan.label} · ₹${plan.priceInr}`}
          </button>
          {isPremium && (
            <button
              onClick={() => navigate({ to: "/subscription" })}
              className="mt-3 w-full rounded-full border border-border bg-background py-3 text-sm font-semibold"
            >
              Manage subscription
            </button>
          )}
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            One-time payment for the chosen duration — it does not auto-renew.
            Payments are processed securely by Razorpay.
          </p>
        </div>
      </div>
    </div>
  );
}
