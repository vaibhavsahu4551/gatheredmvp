import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "phone" | "email";

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}

function phoneToEmail(phone: string): string {
  return `${phone}@huddl.local`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("phone");
  const [isSignup, setIsSignup] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const submitPhone = async () => {
    const digits = normalizePhone(phone);
    if (digits.length < 6) return toast.error("Enter a valid phone number");
    if (password.length < 6) return toast.error("Password must be 6+ characters");
    setLoading(true);
    try {
      const fakeEmail = phoneToEmail(digits);
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email: fakeEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (error) throw error;
      }
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/home" },
      });
      if (error) throw error;
      setMagicSent(true);
      toast.success("Check your email for the login link");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-4">
        <Link to="/" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <main className="flex-1 px-6 pt-8 max-w-md mx-auto w-full">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "phone" ? (isSignup ? "Create account" : "Welcome back") : "Sign in with email"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "phone"
            ? "Use your phone number and a password."
            : "We'll email you a one-tap login link."}
        </p>

        <div className="mt-6 inline-flex rounded-full bg-muted p-1 text-sm">
          <button
            onClick={() => setMode("phone")}
            className={`px-4 py-1.5 rounded-full transition ${mode === "phone" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Phone
          </button>
          <button
            onClick={() => setMode("email")}
            className={`px-4 py-1.5 rounded-full transition ${mode === "email" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Email link
          </button>
        </div>

        {mode === "phone" ? (
          <div className="mt-6 space-y-3">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPhone()}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={submitPhone}
              disabled={loading}
              className="w-full rounded-full bg-primary px-6 py-3.5 text-[15px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </button>
            <button
              onClick={() => setIsSignup((v) => !v)}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {isSignup ? "Have an account? Sign in" : "New here? Create an account"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitEmail()}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={submitEmail}
              disabled={loading}
              className="w-full rounded-full bg-primary px-6 py-3.5 text-[15px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send login link"}
            </button>
            {magicSent && (
              <p className="text-center text-xs text-muted-foreground">
                Link sent. Open it on this device to sign in.
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you confirm you're 18+ and agree to our Terms.
        </p>
      </main>
    </div>
  );
}
