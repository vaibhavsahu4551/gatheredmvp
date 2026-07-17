import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFirebaseAuth } from "@/integrations/firebase/client";
import { bridgeFirebaseAuth } from "@/lib/firebase-auth.functions";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const ensureRecaptcha = async () => {
    if (recaptchaRef.current) return recaptchaRef.current;
    const auth = await getFirebaseAuth();
    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    await verifier.render();
    recaptchaRef.current = verifier;
    return verifier;
  };

  const sendOtp = async () => {
    const trimmed = phone.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      toast.error("Enter phone in international format, e.g. +14155552671");
      return;
    }
    setLoading(true);
    try {
      const auth = await getFirebaseAuth();
      const verifier = await ensureRecaptcha();
      const result = await signInWithPhoneNumber(auth, trimmed, verifier);
      confirmRef.current = result;
      toast.success("Code sent");
      setStep("otp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send code");
      // Reset reCAPTCHA on failure so the next attempt works
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const verify = async (value: string) => {
    if (!confirmRef.current) return;
    setLoading(true);
    try {
      const cred = await confirmRef.current.confirm(value);
      const idToken = await cred.user.getIdToken();
      const { email, tokenHash } = await bridgeFirebaseAuth({ data: { idToken } });
      const { error } = await supabase.auth.verifyOtp({
        email,
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (error) throw error;
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-4">
        {step === "phone" ? (
          <Link to="/" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button
            onClick={() => { setStep("phone"); setCode(""); confirmRef.current = null; }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      <main className="flex-1 px-6 pt-8 max-w-md mx-auto w-full">
        {step === "phone" ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">What's your phone number?</h1>
            <p className="mt-2 text-sm text-muted-foreground">We'll text you a 6-digit code.</p>
            <input
              type="tel"
              autoFocus
              inputMode="tel"
              autoComplete="tel"
              placeholder="+14155552671"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
            <p className="mt-2 text-sm text-muted-foreground">Sent to {phone}</p>
            <div className="mt-8 flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) verify(v);
                }}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button
              onClick={() => { setStep("phone"); setCode(""); confirmRef.current = null; }}
              disabled={loading}
              className="mt-8 w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Didn't get it? Try again
            </button>
          </>
        )}
      </main>

      {/* Invisible reCAPTCHA host */}
      <div id="recaptcha-container" />
    </div>
  );
}
