import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadMe } from "@/lib/huddl";

export const Route = createFileRoute("/_authenticated/pending")({
  component: Pending,
});

function Pending() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    loadMe().then((me) => {
      if (!me) return;
      if (!me.profile?.onboarding_complete) { navigate({ to: "/onboarding" }); return; }
      const s = me.verification?.status ?? "unverified";
      if (s === "verified") { navigate({ to: "/home" }); return; }
      setStatus(s);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <ShieldCheck className="h-7 w-7 text-primary" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">You're on the list</h1>
      <p className="mt-3 text-[15px] text-muted-foreground max-w-sm leading-relaxed">
        We're reviewing your selfie and profile. Verification usually takes a few hours.
        We'll let you know as soon as you're in.
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Status: {status === "pending" ? "Under review" : "Not submitted"}
      </div>
      <button
        onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
        className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
