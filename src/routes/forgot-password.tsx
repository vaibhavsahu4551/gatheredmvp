import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getFirebaseApp } from "@/lib/push";
import { resetPasswordWithFirebase } from "@/lib/reset-password.functions";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your Gathr password" },
      { name: "description", content: "Verify your phone number with a one-time code and set a new Gathr password." },
      { property: "og:title", content: "Reset your Gathr password" },
      { property: "og:description", content: "Verify your phone number with a one-time code and set a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

const inputCls =
  "mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3.5 text-[15px] outline-none focus:border-transparent focus:ring-2 focus:ring-[color:var(--brand-2)]/40";

type Step = "phone" | "otp" | "password";

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState("+91");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const confirmationRef = useRef<any>(null);
  const verifierRef = useRef<any>(null);
  const idTokenRef = useRef<string>("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async (resend = false) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) return toast.error("Enter a valid phone number");
    setBusy(true);
    try {
      const app = await getFirebaseApp();
      if (!app) throw new Error("Phone verification isn't configured yet");
      const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      const auth = getAuth(app);
      if (verifierRef.current) {
        verifierRef.current.clear();
        verifierRef.current = null;
      }
      verifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });

      const full = `${country}${digits}`;
      confirmationRef.current = await signInWithPhoneNumber(auth, full, verifierRef.current);
      setStep("otp");
      setCooldown(30);
      toast.success(resend ? "New code sent" : `Code sent to ${full}`);
    } catch (e: any) {
      const msg = `${e?.message ?? ""}`.toLowerCase();
      if (msg.includes("invalid-phone")) toast.error("That phone number looks invalid");
      else if (msg.includes("too-many")) toast.error("Too many attempts. Try again later.");
      else toast.error(e?.message ?? "Couldn't send the code");
      verifierRef.current?.clear?.();
      verifierRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (code.replace(/\D/g, "").length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const result = await confirmationRef.current.confirm(code.replace(/\D/g, ""));
      idTokenRef.current = await result.user.getIdToken();
      setStep("password");
    } catch (e: any) {
      const msg = `${e?.message ?? ""}`.toLowerCase();
      if (msg.includes("expired")) toast.error("That code expired — request a new one");
      else toast.error("Incorrect code. Please check and try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = useServerFn(resetPasswordWithFirebase);
  const submitPassword = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      await reset({ data: { idToken: idTokenRef.current, password } });
      const app = await getFirebaseApp();
      if (app) {
        const { getAuth, signOut } = await import("firebase/auth");
        await signOut(getAuth(app)).catch(() => {});
      }
      toast.success("Password updated — please log in");
      navigate({ to: "/auth" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[38vh] -z-10" style={{ backgroundImage: "var(--gradient-brand)" }} />
      <div aria-hidden className="absolute inset-x-0 top-[32vh] h-40 -z-10 bg-gradient-to-b from-transparent to-background" />

      <div className="px-4 pt-4">
        <Link to="/auth" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <main className="flex-1 px-6 pt-6 pb-10 max-w-md mx-auto w-full">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-[11px] font-semibold text-white">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure reset
        </div>
        <h1 className="mt-4 text-[30px] font-bold tracking-tight leading-tight text-white drop-shadow-sm">
          Forgot your<br />password?
        </h1>

        <div className="mt-6 rounded-3xl bg-card shadow-card ring-1 ring-black/5 p-5">
          {step === "phone" && (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">
                Enter your registered phone number and we'll text you a 6-digit code.
              </p>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Phone number</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-20 rounded-2xl border border-input bg-background px-3 py-3.5 text-[15px] outline-none"
                  />
                  <input
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="flex-1 rounded-2xl border border-input bg-background px-4 py-3.5 text-[15px] outline-none"
                  />
                </div>
              </label>
              <button onClick={() => sendOtp()} disabled={busy}
                className="w-full h-12 rounded-full text-white text-[15px] font-semibold shadow-glow disabled:opacity-60"
                style={{ backgroundImage: "var(--gradient-brand)" }}>
                {busy ? "Sending…" : "Send code"}
              </button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">
                Enter the 6-digit code sent to {country}{phone.replace(/\D/g, "")}.
              </p>
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••"
                className={`${inputCls} text-center tracking-[0.5em] text-lg`}
              />
              <button onClick={verifyOtp} disabled={busy}
                className="w-full h-12 rounded-full text-white text-[15px] font-semibold shadow-glow disabled:opacity-60"
                style={{ backgroundImage: "var(--gradient-brand)" }}>
                {busy ? "Verifying…" : "Verify code"}
              </button>
              <button onClick={() => sendOtp(true)} disabled={busy || cooldown > 0}
                className="w-full text-[12px] font-semibold text-muted-foreground disabled:opacity-50">
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">Choose a new password for your account.</p>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">New password</span>
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confirm password</span>
                <input type="password" autoComplete="new-password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className={inputCls} />
              </label>
              <button onClick={submitPassword} disabled={busy}
                className="w-full h-12 rounded-full text-white text-[15px] font-semibold shadow-glow disabled:opacity-60"
                style={{ backgroundImage: "var(--gradient-brand)" }}>
                {busy ? "Saving…" : "Update password"}
              </button>
            </div>
          )}

          <div id="recaptcha-container" />
        </div>
      </main>
    </div>
  );
}
