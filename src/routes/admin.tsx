import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/admin";
import { LayoutDashboard, Users, Calendar, Flag, Settings, LogOut, Gift, Image as ImageIcon, BadgeCheck, ShieldAlert, Sparkles, IndianRupee, Clapperboard, Share2, Music, Award } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isCurrentUserAdmin()
      .then((ok) => {
        if (!ok) navigate({ to: "/admin-login" });
        else setReady(true);
      })
      .catch((err) => {
        console.error("Admin access check failed", err);
        const message = err instanceof Error ? err.message : "Couldn't verify admin access.";
        setError(message);
        toast.error(message);
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Admin panel unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button className="mt-5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" /></div>;
  }

  const items: { to: any; label: string; icon: any }[] = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/events", label: "Events", icon: Calendar },
    { to: "/admin/posts", label: "Posts", icon: ImageIcon },
    { to: "/admin/verification", label: "Verification", icon: BadgeCheck },
    { to: "/admin/reports", label: "Reports", icon: Flag },
    { to: "/admin/flagged", label: "Flagged", icon: ShieldAlert },
    { to: "/admin/engagement", label: "Engagement", icon: Sparkles },
    { to: "/admin/revenue", label: "Revenue", icon: IndianRupee },
    { to: "/admin/rewards", label: "Rewards", icon: Gift },
    { to: "/admin/badges", label: "Badges", icon: Award },
    { to: "/admin/stories", label: "Stories", icon: Clapperboard },
    { to: "/admin/referrals", label: "Referrals", icon: Share2 },
    { to: "/admin/music", label: "Music Library", icon: Music },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ];


  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 p-4">
        <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)] rounded-2xl bg-card border border-border p-3 flex md:flex-col gap-1 overflow-x-auto">
          <div className="hidden md:block px-2 pb-3">
            <div className="text-sm font-semibold">Gathr Admin</div>
            <div className="text-[11px] text-muted-foreground">Restricted panel</div>
          </div>
          {items.map((it) => {
            const active = pathname === it.to || (it.to !== "/admin" && pathname.startsWith(it.to));
            const Icon = it.icon;
            return (
              <Link key={it.to} to={it.to} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{it.label}</span>
              </Link>
            );
          })}
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/admin-login" }); }}
            className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </aside>
        <main className="rounded-2xl bg-card border border-border p-4 md:p-6 min-h-[70vh]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
