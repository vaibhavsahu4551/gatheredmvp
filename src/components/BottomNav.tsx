import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Ticket, Plus, MessageCircle, User, Sparkles } from "lucide-react";
import { useDmUnread } from "@/hooks/useDmUnread";
import { supabase } from "@/integrations/supabase/client";

/** Routes where the app chrome (bottom nav) should NOT appear. */
const HIDDEN_PREFIXES = [
  "/auth",
  "/onboarding",
  "/admin",
  "/admin-login",
  "/checkin",
  "/forgot-password",
  "/organiser",
  "/api",
];

export function useShowBottomNav() {
  const { pathname } = useLocation();
  if (pathname === "/") return false;
  return !HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function BottomNav() {
  const { pathname } = useLocation();
  const { totalUnread } = useDmUnread();
  const [pride, setPride] = useState(false);

  // Pride tab only shows for opted-in, signed-in users. Signed-out users just
  // get the standard 5 tabs.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) setPride(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("pride_opt_in")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setPride(!!(data as any)?.pride_opt_in);
    })().catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  type NavItem = { to: "/home" | "/passes" | "/create" | "/chat" | "/profile" | "/pride"; label: string; icon: typeof Home; primary?: boolean };
  const items: NavItem[] = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/passes", label: "Passes", icon: Ticket },
    { to: "/create", label: "Create", icon: Plus, primary: true },
    { to: "/chat", label: "Chat", icon: MessageCircle },
    { to: "/profile", label: "Profile", icon: User },
  ];
  if (pride) items.splice(2, 0, { to: "/pride", label: "Pride", icon: Sparkles });
  const cols = items.length === 6 ? "grid-cols-6" : "grid-cols-5";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur border-t border-border">
      <div className={`max-w-md mx-auto grid ${cols} h-16 px-2 safe-bottom`}>
        {items.map((it) => {
          const active = pathname === it.to || (it.to === "/pride" && pathname.startsWith("/pride"));
          const Icon = it.icon;
          if (it.primary) {
            return (
              <Link key={it.to} to={it.to} search={{} as any} className="flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-gradient-brand flex items-center justify-center shadow-glow ring-4 ring-background">
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </Link>
            );
          }

          const showBadge = it.to === "/chat" && totalUnread > 0;
          return (
            <Link key={it.to} to={it.to} search={{} as any} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? "text-gradient-brand" : "text-muted-foreground"}`}>
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
