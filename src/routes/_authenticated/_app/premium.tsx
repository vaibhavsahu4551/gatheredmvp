import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  getMySubscriptionState,
  PREMIUM_PRICE_INR,
  type SubscriptionState,
} from "@/lib/subscription";
import { createRazorpaySubscription } from "@/lib/razorpay.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/premium")({
  component: PremiumScreen,
});

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
  { label: "Priority visibility on your events", free: false, premium: true },
  { label: "Unlimited hosted events", free: false, premium: true },
  { label: "See who liked your posts", free: false, premium: true },
  { label: "Advanced filters & search", free: false, premium: true },
  { label: "Premium badge on your profile", free: false, premium: true },
  { label: "Early access to new features", free: false, premium: true },
];

function PremiumScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [busy, setBusy] = useState(false);
  const createSub = useServerFn(createRazorpaySubscription);

  useEffect(() => {
    getMySubscriptionState().then(setState);
    loadRazorpay();
  }, []);

  const onSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Couldn't load Razorpay. Check your connection.");

      const { subscription_id, key_id } = await createSub();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user?.id ?? "")
        .maybeSingle();

      const rzp = new window.Razorpay({
        key: key_id,
        subscription_id,
        name: "Gathr Premium",
        description: `₹${PREMIUM_PRICE_INR}/month`,
        theme: { color: "#ec4899" },
        prefill: {
          name: (profile as any)?.full_name ?? "",
          contact: (profile as any)?.phone ?? "",
          email: user?.email ?? "",
        },
        handler: async () => {
          toast.success("Payment received! Activating premium…");
          // Webhook flips subscription_tier; refresh state after a beat.
          setTimeout(async () => {
            const next = await getMySubscriptionState();
            setState(next);
            navigate({ to: "/subscription" });
          }, 1500);
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
            <div className="text-4xl font-bold">₹{PREMIUM_PRICE_INR}</div>
            <div className="text-sm opacity-90">/ month</div>
          </div>
          <p className="mt-2 text-sm opacity-95">
            Auto-renews monthly via UPI, card, or netbanking. Cancel anytime.
          </p>
        </div>

        {state && !state.subscriptionsEnabled && (
          <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-3 text-[13px]">
            Premium is currently free for everyone while we finalise pricing —
            you already have full access.
          </div>
        )}

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
          {isPremium ? (
            <button
              onClick={() => navigate({ to: "/subscription" })}
              className="w-full rounded-full border border-border bg-background py-3.5 text-sm font-semibold"
            >
              Manage subscription
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={onSubscribe}
              className="w-full rounded-full bg-gradient-brand text-white py-3.5 text-sm font-semibold shadow-glow disabled:opacity-60"
            >
              {busy ? "Opening checkout…" : `Subscribe · ₹${PREMIUM_PRICE_INR}/mo`}
            </button>
          )}
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            By subscribing you agree to Gathr's Terms. Payments are processed
            securely by Razorpay.
          </p>
        </div>
      </div>
    </div>
  );
}
