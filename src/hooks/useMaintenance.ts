import { useEffect, useState } from "react";
import { getAppSettings, isCurrentUserAdmin } from "@/lib/admin";

/**
 * Maintenance mode gate. Admins are exempt so they can keep working
 * (and verify) while the app is locked for everyone else.
 */
export function useMaintenance() {
  const [state, setState] = useState<{ loading: boolean; blocked: boolean; message: string | null }>({
    loading: true,
    blocked: false,
    message: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getAppSettings();
        if (!s.maintenance_enabled) {
          if (alive) setState({ loading: false, blocked: false, message: null });
          return;
        }
        const admin = await isCurrentUserAdmin().catch(() => false);
        if (alive) setState({ loading: false, blocked: !admin, message: s.maintenance_message });
      } catch {
        if (alive) setState({ loading: false, blocked: false, message: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  return state;
}
