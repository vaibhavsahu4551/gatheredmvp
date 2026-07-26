import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-login")({
  ssr: false,
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const ok = await isCurrentUserAdmin();
      if (!ok) {
        await supabase.auth.signOut();
        throw new Error("This account is not an admin.");
      }
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Gathr Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Restricted access.</p>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" autoComplete="username" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" autoComplete="current-password" />
        </label>
        <button disabled={loading} type="submit" className="w-full rounded-full bg-foreground text-background py-2.5 text-sm font-medium disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
