import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  getMySubscriptionState,
  PREMIUM_PRICE_INR,
  type SubscriptionState,
} from "@/lib/subscription";
import { cancelRazorpaySubscription } from "@/lib/razorpay.functions";

export const Route = createFileRoute("/_authenticated/_app/subscription")({
  component: ManageSubscription,
});

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return d; }
}

function ManageSubscription() {
  const navigate = useNavigate();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [busy, setBusy] = useState(false);
  const cancel = useServerFn(cancelRazorpaySubscription);

  const refresh = () => getMySubscriptionState().then(setState);
  useEffect(() => { refresh(); }, []);

  const onCancel = async () => {
    if (!confirm("Cancel your Gathr Premium subscription? You'll keep access until the end of the current billing cycle.")) return;
    setBusy(true);
    try {
      await cancel({ data: { immediate: false } });
      toast.success("Subscription cancelled. You'll stay premium until the cycle ends.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't cancel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <button
          onClick={() => (history.length > 1 ? history.back() : navigate({ to: "/profile" }))}
          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Subscription</h1>
      </header>

      <div className="px-5 space-y-4 pb-24">
        {!state && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        )}

        {state && (
          <>
            <div className="rounded-3xl border border-border p-5 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-gradient-brand flex items-center justify-center shadow-glow">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Current plan</div>
                    <div className="text-lg font-semibold">
                      {state.tier === "premium" ? "Gathr Premium" : "Free"}
                    </div>
                  </div>
                </div>
                {state.tier === "premium" && (
                  <span className="rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-semibold px-2.5 py-1">
                    Active
                  </span>
                )}
              </div>

              {!state.subscriptionsEnabled && (
                <div className="mt-4 rounded-xl bg-muted/60 p-3 text-[12px]">
                  Premium is currently free for everyone — the admin has paused
                  paid subscriptions, so all features are unlocked regardless of
                  your tier.
                </div>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Price</dt>
                  <dd className="font-medium">₹{PREMIUM_PRICE_INR} / month</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Status</dt>
                  <dd className="font-medium capitalize">
                    {state.subscription?.status ?? (state.tier === "premium" ? "active" : "—")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {state.subscription?.cancelled_at ? "Ends on" : "Renews on"}
                  </dt>
                  <dd className="font-medium">
                    {fmt(state.expiresAt ?? state.subscription?.current_end ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Started</dt>
                  <dd className="font-medium">
                    {fmt(state.subscription?.current_start ?? state.subscription?.created_at ?? null)}
                  </dd>
                </div>
              </dl>
            </div>

            {state.tier === "premium" && !state.subscription?.cancelled_at && (
              <button
                disabled={busy}
                onClick={onCancel}
                className="w-full rounded-full border border-border py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {busy ? "Cancelling…" : "Cancel subscription"}
              </button>
            )}

            {state.tier !== "premium" && state.subscriptionsEnabled && (
              <Link
                to="/premium"
                className="block w-full text-center rounded-full bg-gradient-brand text-white py-3.5 text-sm font-semibold shadow-glow"
              >
                Upgrade to Premium
              </Link>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              Payments and refunds are handled by Razorpay. For billing help,
              contact support@gathr.app.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
