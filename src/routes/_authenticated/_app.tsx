import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadMe } from "@/lib/huddl";
import { supabase } from "@/integrations/supabase/client";
import { Home, Calendar, Plus, MessageCircle, User, Sparkles } from "lucide-react";
import { useDmUnread } from "@/hooks/useDmUnread";
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

  // Refresh pride opt-in on every navigation so toggling it in Edit Profile
  // reflects in the bottom nav immediately, without a refresh/re-login.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("pride_opt_in")
        .eq("id", user.id)
        .maybeSingle();
      if (alive && data) setPride(!!(data as any).pride_opt_in);
    })();
    return () => { alive = false; };
  }, [pathname]);

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

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />
      <BottomNav pride={pride} />
    </div>
  );
}

function BottomNav({ pride }: { pride: boolean }) {
  const { pathname } = useLocation();
  const { totalUnread } = useDmUnread();
  type NavItem = { to: "/home" | "/events" | "/create" | "/chat" | "/profile" | "/pride"; label: string; icon: typeof Home; primary?: boolean };
  const items: NavItem[] = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/events", label: "Events", icon: Calendar },
    { to: "/create", label: "Create", icon: Plus, primary: true },
    { to: "/chat", label: "Chat", icon: MessageCircle },
    { to: "/profile", label: "Profile", icon: User },
  ];
  if (pride) {
    // Replace Events slot with Pride when opted in? No — keep Events, swap Chat for Pride would confuse.
    // Add Pride between Events and Create by inserting; keep 5-slot layout by removing Chat from bar (Chat remains reachable from Profile / URLs).
    items.splice(2, 0, { to: "/pride", label: "Pride", icon: Sparkles });
  }
  const cols = items.length === 6 ? "grid-cols-6" : "grid-cols-5";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur border-t border-border">
      <div className={`max-w-md mx-auto grid ${cols} h-16 px-2 safe-bottom`}>
        {items.map((it) => {
          const active = pathname === it.to || (it.to === "/pride" && pathname.startsWith("/pride"));
          const Icon = it.icon;
          if (it.primary) {
            return (
              <Link key={it.to} to={it.to} className="flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-gradient-brand flex items-center justify-center shadow-glow ring-4 ring-background">
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </Link>
            );
          }

          const showBadge = it.to === "/chat" && totalUnread > 0;
          return (
            <Link key={it.to} to={it.to} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? "text-gradient-brand" : "text-muted-foreground"}`}>
              <div className="relative">
                <Icon className={`h-5 w-5 ${active ? "" : "opacity-70"}`} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </div>
              {it.label}
            </Link>
          );

        })}
      </div>
    </nav>
  );
}
