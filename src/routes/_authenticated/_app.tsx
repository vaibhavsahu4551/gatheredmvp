import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadMe } from "@/lib/huddl";
import { supabase } from "@/integrations/supabase/client";
import { enablePush, pushAsked, pushDeclined } from "@/lib/push";
import { useMaintenance } from "@/hooks/useMaintenance";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [pride, setPride] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const maintenance = useMaintenance();


  useEffect(() => {
    loadMe()
      .then((me) => {
        if (!me) { navigate({ to: "/auth" }); return; }
        if (!me.profile?.onboarding_complete) { navigate({ to: "/onboarding" }); return; }
        setPride(!!me.profile?.pride_opt_in);
        // Logging back in reactivates a temporarily deactivated account.
        (supabase as any)
          .from("user_settings")
          .update({ deactivated_at: null })
          .eq("user_id", me.user.id)
          .not("deactivated_at", "is", null)
          .then(() => {}, () => {});
        setReady(true);
        // Ask for notification permission once, shortly after the app opens.
        // Declines are remembered so we never nag.
        if (!pushDeclined() && !pushAsked()) {
          setTimeout(() => {
            void enablePush((url) => navigate({ to: url as any }));
          }, 2500);
        } else if (!pushDeclined()) {
          void enablePush((url) => navigate({ to: url as any }));
        }
      })
      .catch((error) => {
        console.error("App profile load failed", error);
        setLoadError(error instanceof Error ? error.message : "Couldn't load your profile.");
      });
  }, [navigate]);


  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">We couldn't open Gathr</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (maintenance.blocked) {
    return <MaintenanceScreen message={maintenance.message} />;
  }

  if (!ready || maintenance.loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }

  return <Outlet />;
}
