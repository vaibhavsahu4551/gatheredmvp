import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadMe } from "@/lib/huddl";
import { Home, Calendar, Plus, MessageCircle, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadMe().then((me) => {
      if (!me) return;
      if (!me.profile?.onboarding_complete) { navigate({ to: "/onboarding" }); return; }
      if (me.verification?.status !== "verified") { navigate({ to: "/pending" }); return; }
      setReady(true);
    });
  }, [navigate]);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const items: { to: "/home" | "/events" | "/create" | "/chat" | "/profile"; label: string; icon: typeof Home; primary?: boolean }[] = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/events", label: "Events", icon: Calendar },
    { to: "/create", label: "Create", icon: Plus, primary: true },
    { to: "/chat", label: "Chat", icon: MessageCircle },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 px-2 safe-bottom">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          if (it.primary) {
            return (
              <Link key={it.to} to={it.to} className="flex items-center justify-center">
                <div className="h-11 w-11 rounded-full bg-primary flex items-center justify-center shadow-card">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
              </Link>
            );
          }
          return (
            <Link key={it.to} to={it.to} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
              <Icon className={`h-5 w-5 ${active ? "" : "opacity-70"}`} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
