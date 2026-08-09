import { useEffect, useState } from "react";
import { getMyEntitlements } from "@/lib/entitlements";

export type PremiumGate = {
  /** Admin master switch. When false, monetization is off platform-wide. */
  subscriptionsEnabled: boolean;
  /** Effective access — always true when subscriptions are disabled. */
  hasAccess: boolean;
  /** Show premium marketing / paywall UI at all? */
  showPremiumUi: boolean;
  loading: boolean;
};

/**
 * Single source of truth for every Premium-gated surface.
 * When the admin "Subscription" toggle is OFF, everyone gets full access and
 * ALL premium marketing UI (banners, badges, upgrade buttons, locks) is hidden.
 */
export function usePremiumGate(): PremiumGate {
  const [state, setState] = useState<PremiumGate>({
    subscriptionsEnabled: false,
    hasAccess: true,
    showPremiumUi: false,
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    getMyEntitlements()
      .then((e) => {
        if (!alive) return;
        setState({
          subscriptionsEnabled: e.subscriptionsEnabled,
          hasAccess: e.hasAccess,
          showPremiumUi: e.subscriptionsEnabled,
          loading: false,
        });
      })
      .catch(() => alive && setState((s) => ({ ...s, loading: false })));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
