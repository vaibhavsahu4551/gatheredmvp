import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SettingsShell } from "@/components/SettingsUI";
import { changeMyPhone } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/_app/settings/phone")({
  head: () => ({
    meta: [
      { title: "Change phone number — Gathr" },
      { name: "description", content: "Update the phone number you use to sign in to Gathr." },
      { property: "og:title", content: "Change phone number — Gathr" },
      { property: "og:description", content: "Update the phone number you use to sign in to Gathr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangePhone,
});

const inputCls =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function ChangePhone() {
  const [currentPhone, setCurrentPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const change = useServerFn(changeMyPhone);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      setCurrentPhone(email.split("@")[0] ?? "");
    });
  }, []);

  const submit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return toast.error("Enter a valid phone number");
    if (!password) return toast.error("Enter your password to re-verify");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Sign in required");
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (verifyError) throw new Error("That password is incorrect");
      await change({ data: { phone: digits } });
      await supabase.auth.refreshSession();
      toast.success("Phone number updated — use it next time you sign in");
      setCurrentPhone(digits);
      setPhone(""); setPassword("");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't change your number");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsShell title="Change phone number">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Current number</div>
          <div className="text-[15px] font-semibold">{currentPhone || "—"}</div>
        </div>
        <input inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="New phone number" className={inputCls} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password (re-verification)" className={inputCls} />
        <button onClick={submit} disabled={busy} className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
          {busy ? "Updating…" : "Update number"}
        </button>
      </div>
    </SettingsShell>
  );
}
