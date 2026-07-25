import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Phone, Mail, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Join Gathr — meet verified people, plan real hangouts" },
      { name: "description", content: "Sign up or log in to Gathr. 18+ verified group meetups for coffee, dinner, drinks, gaming and more." },
      { property: "og:title", content: "Join Gathr" },
      { property: "og:description", content: "18+ verified group meetups. Sign up or log in to start." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Tab = "signup" | "login";
type Method = "phone" | "email";

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}
function phoneToEmail(phone: string): string {
  return `${phone}@huddl.local`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signup");
  const [method, setMethod] = useState<Method>("phone");
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
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({ email: fakeEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (error) throw error;
      }
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
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

  const ctaLabel =
    method === "email"
      ? loading ? "Sending…" : "Send magic link"
      : loading
        ? "Please wait…"
        : tab === "signup" ? "Create my account" : "Log in";

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* vibrant hero backdrop */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[52vh] -z-10"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      />
      <div aria-hidden className="absolute inset-x-0 top-[46vh] h-40 -z-10 bg-gradient-to-b from-transparent to-background" />

      <div className="px-4 pt-4">
        <Link
          to="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <main className="flex-1 px-6 pt-6 pb-10 max-w-md mx-auto w-full">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-[11px] font-semibold text-white">
          <ShieldCheck className="h-3.5 w-3.5" /> Verified · 18+ only
        </div>
        <h1 className="mt-4 text-[34px] font-bold tracking-tight leading-[1.05] text-white drop-shadow-sm">
          Your next<br />night out<br />starts here.
        </h1>
        <p className="mt-3 text-[14px] text-white/85 max-w-xs">
          Coffee, dinner, drinks, gaming — plan real hangouts with people who actually show up.
        </p>

        {/* Tabs */}
        <div className="mt-8 grid grid-cols-2 rounded-full bg-white/95 p-1 shadow-glow">
          <button
            onClick={() => setTab("signup")}
            className={`h-11 rounded-full text-[14px] font-semibold transition ${
              tab === "signup" ? "text-white shadow-md" : "text-foreground/70"
            }`}
            style={tab === "signup" ? { backgroundImage: "var(--gradient-brand)" } : undefined}
          >
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Sign up</span>
          </button>
          <button
            onClick={() => setTab("login")}
            className={`h-11 rounded-full text-[14px] font-semibold transition ${
              tab === "login" ? "text-white shadow-md" : "text-foreground/70"
            }`}
            style={tab === "login" ? { backgroundImage: "var(--gradient-brand)" } : undefined}
          >
            Log in
          </button>
        </div>

        {/* Card */}
        <div className="mt-4 rounded-3xl bg-card shadow-card ring-1 ring-black/5 p-5">
          <div className="text-[13px] font-medium text-muted-foreground">
            {tab === "signup" ? "Create your account with:" : "Log in with:"}
          </div>

          {/* Method selector */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <MethodPill active={method === "phone"} onClick={() => setMethod("phone")} icon={<Phone className="h-4 w-4" />} label="Phone + password" />
            <MethodPill active={method === "email"} onClick={() => setMethod("email")} icon={<Mail className="h-4 w-4" />} label="Email magic link" />
          </div>

          {method === "phone" ? (
            <div className="mt-4 space-y-3">
              <LabeledInput
                label="Phone number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="Just digits, e.g. 9876543210"
                value={phone}
                onChange={setPhone}
              />
              <LabeledInput
                label="Password"
                type="password"
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={setPassword}
                onEnter={submitPhone}
              />
              <button
                onClick={submitPhone}
                disabled={loading}
                className="w-full h-12 rounded-full text-white text-[15px] font-semibold shadow-glow disabled:opacity-60 active:scale-[0.99] transition"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                {ctaLabel}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <LabeledInput
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={setEmail}
                onEnter={submitEmail}
              />
              <button
                onClick={submitEmail}
                disabled={loading}
                className="w-full h-12 rounded-full text-white text-[15px] font-semibold shadow-glow disabled:opacity-60 active:scale-[0.99] transition"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                {ctaLabel}
              </button>
              {magicSent && (
                <p className="text-center text-xs text-muted-foreground">
                  Link sent. Open it on this device to sign in.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 text-center text-[12px] text-muted-foreground">
            {tab === "signup" ? (
              <>Already have an account?{" "}
                <button onClick={() => setTab("login")} className="font-semibold text-gradient-brand">Log in</button>
              </>
            ) : (
              <>New to Gathr?{" "}
                <button onClick={() => setTab("signup")} className="font-semibold text-gradient-brand">Create account</button>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          By continuing you confirm you're 18+ and agree to our Terms.
        </p>
      </main>
    </div>
  );
}

function MethodPill({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 h-11 rounded-2xl text-[13px] font-semibold transition ${
        active
          ? "text-white shadow-sm"
          : "bg-muted text-foreground/70"
      }`}
      style={active ? { backgroundImage: "var(--gradient-brand)" } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function LabeledInput({
  label, value, onChange, onEnter, ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3.5 text-[15px] outline-none focus:border-transparent focus:ring-2 focus:ring-[color:var(--brand-2)]/40"
      />
    </label>
  );
}
