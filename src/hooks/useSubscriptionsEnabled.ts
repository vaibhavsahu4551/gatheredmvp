import { useEffect, useState } from "react";
import { getAppSettingsCached } from "@/lib/admin";

/**
 * Admin master switch for monetization.
 * false => hide ALL premium marketing/paywall UI and treat everyone as premium.
 */
export function useSubscriptionsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    getAppSettingsCached()
      .then((s) => alive && setEnabled(!!s.subscription_enabled))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}
