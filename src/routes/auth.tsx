import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const sendOtp = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Code sent — check your email");
    setStep("otp");
  };

  const verify = async (value: string) => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: value, type: "email" });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/home" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-4">
        {step === "email" ? (
          <Link to="/" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button onClick={() => { setStep("email"); setCode(""); }} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      <main className="flex-1 px-6 pt-8 max-w-md mx-auto w-full">
        {step === "email" ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">What's your email?</h1>
            <p className="mt-2 text-sm text-muted-foreground">We'll send you a 6-digit code to sign in.</p>
            <input
              type="email"
              autoFocus
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendOtp()}
              className="mt-8 w-full rounded-2xl border border-input bg-background px-4 py-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={sendOtp}
              disabled={loading}
              className="mt-4 w-full rounded-full bg-primary px-6 py-3.5 text-[15px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you confirm you're 18+ and agree to our Terms.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Enter the code</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sent to {email}</p>
            <div className="mt-8 flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={(v) => {
                setCode(v);
                if (v.length === 6) verify(v);
              }}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button
              onClick={sendOtp}
              disabled={loading}
              className="mt-8 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Didn't get it? Resend code
            </button>
          </>
        )}
      </main>
    </div>
  );
}
