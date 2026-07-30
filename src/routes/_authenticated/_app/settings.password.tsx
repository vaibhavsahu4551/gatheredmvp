import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SettingsShell } from "@/components/SettingsUI";

export const Route = createFileRoute("/_authenticated/_app/settings/password")({
  head: () => ({
    meta: [
      { title: "Change password — Gathr" },
      { name: "description", content: "Update the password you use to sign in to Gathr." },
      { property: "og:title", content: "Change password — Gathr" },
      { property: "og:description", content: "Update the password you use to sign in to Gathr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangePassword,
});

const inputCls =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current) return toast.error("Enter your current password");
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("New passwords don't match");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Sign in required");
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (verifyError) throw new Error("Your current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsShell title="Change password">
      <div className="space-y-4">
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" className={inputCls} />
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (8+ characters)" className={inputCls} />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={inputCls} />
        <button onClick={submit} disabled={busy} className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>
    </SettingsShell>
  );
}
