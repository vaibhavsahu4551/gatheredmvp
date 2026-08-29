import { supabase } from "@/integrations/supabase/client";
import { getAppSettingsCached } from "@/lib/admin";

export const PREMIUM_PRICE_INR = 79;

export type SubscriptionRecord = {
  id: string;
  user_id: string;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  plan_id: string | null;
  status: string;
  current_start: string | null;
  current_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionState = {
  /** True if the user has effective premium access (respects admin toggle). */
  hasPremiumAccess: boolean;
  /** Actual tier stored on the profile. */
  tier: "free" | "premium";
  /** True when admin has paused subscriptions platform-wide (everyone gets access). */
  subscriptionsEnabled: boolean;
  expiresAt: string | null;
  subscription: SubscriptionRecord | null;
};

/**
 * Returns the current user's subscription state.
 * Fail-open: if admin disables subscriptions platform-wide, everyone has access.
 */
export async function getMySubscriptionState(): Promise<SubscriptionState> {
  const [{ data: { user } }, settings] = await Promise.all([
    supabase.auth.getUser(),
    getAppSettingsCached(),
  ]);

  const subscriptionsEnabled = !!settings.subscription_enabled;

  if (!user) {
    return {
      hasPremiumAccess: !subscriptionsEnabled,
      tier: "free",
      subscriptionsEnabled,
      expiresAt: null,
      subscription: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, premium_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  const tier = ((profile as any)?.subscription_tier ?? "free") as "free" | "premium";
  const expiresAt = (profile as any)?.premium_expires_at ?? null;

  const activePremium =
    tier === "premium" && (!expiresAt || new Date(expiresAt).getTime() > Date.now());

  // Fail-open: if admin turned monetization off, everyone gets access.
  const hasPremiumAccess = !subscriptionsEnabled || activePremium;

  const { data: sub } = await supabase
    .from("subscriptions" as any)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    hasPremiumAccess,
    tier,
    subscriptionsEnabled,
    expiresAt,
    subscription: (sub as any) ?? null,
  };
}
