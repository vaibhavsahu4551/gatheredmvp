import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { captureReferralFromUrl } from "@/lib/rewards";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Phone, Apple } from "lucide-react";
import heroImage from "@/assets/auth-hero.jpg";

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
type Mode = "choose" | "phone";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.8 6.6-9.5 6.6-17z" />
      <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.9l-7.1-5.5c-2 1.3-4.6 2.1-8.8 2.1-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}
function phoneToEmail(phone: string): string {
  return `${phone}@huddl.local`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signup");
  const [mode, setMode] = useState<Mode>("choose");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showApple, setShowApple] = useState(false);

  useEffect(() => { captureReferralFromUrl(); }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setShowApple(/iPhone|iPad|iPod|Macintosh/i.test(ua));
  }, []);

  const submitApple = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Apple sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apple sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const submitPhone = async () => {
    const digits = normalizePhone(phone);
    if (digits.length < 6) return toast.error("Enter a valid phone number");
    if (tab === "signup" && password.length < 8) return toast.error("Password must be at least 8 characters");
    if (tab === "login" && password.length === 0) return toast.error("Enter your password");
    setLoading(true);
    try {
      const fakeEmail = phoneToEmail(digits);
      if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: fakeEmail, password });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            throw new Error("This phone number is already registered. Try logging in instead.");
          }
          throw error;
        }
        // If email confirmation is required, no session is returned — sign in explicitly.
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
          if (signInErr) {
            const m = signInErr.message.toLowerCase();
            if (m.includes("not confirmed")) {
              throw new Error("Account created but not yet active. Please try logging in again in a moment.");
            }
            throw signInErr;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("invalid") && msg.includes("credentials")) {
            throw new Error("Wrong phone number or password.");
          }
          throw error;
        }
      }
      navigate({ to: "/home" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      toast.error(message);
      console.error("[auth] submitPhone failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const submitGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      {/* Full-screen background image */}
      <img
        src={heroImage}
        alt="Friends laughing together at an evening rooftop gathering"
        className="fixed inset-0 h-[100dvh] w-full object-cover"
      />
      <div
        aria-hidden
        className="fixed inset-0 h-[100dvh] w-full"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.86) 78%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <div className="flex items-center justify-between px-4 pt-4">
          {mode === "choose" ? (
            <Link to="/" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <button
              onClick={() => setMode("choose")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-medium text-white/90">
            <ShieldCheck className="h-3.5 w-3.5" /> 18+ only
          </span>
        </div>

        <div className="flex-1" />

        <div className="w-full max-w-md mx-auto px-6">
          <div className="text-[13px] font-black uppercase tracking-[0.3em] text-white/70">Gathr</div>
          <h1 className="mt-2 text-[30px] font-bold leading-[1.08] tracking-tight text-white drop-shadow-sm">
            Never miss a moment.<br />Discover real hangouts.
          </h1>
        </div>

        <main className="w-full max-w-md mx-auto px-6 pt-6 pb-10">
          {mode === "choose" ? (
            <div className="space-y-3">
              <p className="text-[13px] text-white/70">
                {tab === "signup" ? "Create your account with" : "Log in with"}
              </p>

              <button
                onClick={submitGoogle}
                disabled={loading}
                className="w-full py-4 rounded-full bg-white text-[#1f1f1f] text-[15px] font-semibold ring-1 ring-black/10 shadow-card active:scale-[0.99] transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <GoogleIcon /> Sign in with Google
              </button>

              {showApple && (
                <button
                  onClick={submitApple}
                  disabled={loading}
                  className="w-full py-4 rounded-full bg-black text-white text-[15px] font-semibold active:scale-[0.99] transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Apple className="h-4 w-4" /> Continue with Apple
                </button>
              )}

              <button
                onClick={() => setMode("phone")}
                className="w-full py-4 rounded-full bg-white/12 ring-1 ring-white/30 text-white text-[15px] font-semibold backdrop-blur active:scale-[0.99] transition inline-flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" /> Continue with Phone
              </button>

              <div className="pt-2 text-center text-[13px] text-white/70">
                {tab === "signup" ? (
                  <>Already have an account?{" "}
                    <button onClick={() => setTab("login")} className="font-semibold text-white underline underline-offset-2">Log in</button>
                  </>
                ) : (
                  <>New to Gathr?{" "}
                    <button onClick={() => setTab("signup")} className="font-semibold text-white underline underline-offset-2">Sign up</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white/10 ring-1 ring-white/20 backdrop-blur-xl p-5">
              <div className="grid grid-cols-2 rounded-full bg-white/15 p-1">
                <button
                  onClick={() => setTab("signup")}
                  className={`h-10 rounded-full text-[13px] font-semibold transition ${tab === "signup" ? "text-white shadow-sm" : "text-white/70"}`}
                  style={tab === "signup" ? { backgroundImage: "var(--gradient-brand)" } : undefined}
                >
                  Sign up
                </button>
                <button
                  onClick={() => setTab("login")}
                  className={`h-10 rounded-full text-[13px] font-semibold transition ${tab === "login" ? "text-white shadow-sm" : "text-white/70"}`}
                  style={tab === "login" ? { backgroundImage: "var(--gradient-brand)" } : undefined}
                >
                  Log in
                </button>
              </div>

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
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={setPassword}
                  onEnter={submitPhone}
                />
                {tab === "login" && (
                  <div className="text-right -mt-1">
                    <Link to="/forgot-password" className="text-[12px] font-semibold text-white underline underline-offset-2">
                      Forgot password?
                    </Link>
                  </div>
                )}
                <button
                  onClick={submitPhone}
                  disabled={loading}
                  className="w-full h-12 rounded-full text-white text-[15px] font-semibold shadow-glow disabled:opacity-60 active:scale-[0.99] transition"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                >
                  {loading ? "Please wait…" : tab === "signup" ? "Create my account" : "Log in"}
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[11px] text-white/60">
            By continuing you confirm you're 18+ and agree to our Terms.
          </p>
        </main>
      </div>
    </div>
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
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="mt-1 w-full rounded-2xl border border-white/25 bg-white/10 text-white placeholder:text-white/45 px-4 py-3.5 text-[15px] outline-none focus:border-transparent focus:ring-2 focus:ring-white/40"
      />

    </label>
  );
}
