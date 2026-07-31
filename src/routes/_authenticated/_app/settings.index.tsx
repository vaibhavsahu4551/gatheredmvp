import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  loadSettings,
  saveSettings,
  setPrideOptIn,
  SUPPORT_EMAIL,
  type UserSettings,
} from "@/lib/settings";
import { loadMe } from "@/lib/huddl";
import { SettingsShell, SectionTitle, Toggle, Card, Row } from "@/components/SettingsUI";
import { deleteMyAccount } from "@/lib/account.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/_app/settings/")({
  head: () => ({
    meta: [
      { title: "Settings — Gathr" },
      { name: "description", content: "Manage your Gathr account, privacy, notifications and subscription." },
      { property: "og:title", content: "Settings — Gathr" },
      { property: "og:description", content: "Manage your Gathr account, privacy, notifications and subscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const [s, setS] = useState<UserSettings | null>(null);
  const [pride, setPride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const doDelete = useServerFn(deleteMyAccount);

  useEffect(() => {
    loadSettings().then(setS).catch((e) => toast.error(e?.message ?? "Couldn't load settings"));
    loadMe().then((me) => setPride(!!me?.profile?.pride_opt_in)).catch(() => {});
  }, []);

  const patch = async (p: Partial<UserSettings>) => {
    if (!s) return;
    const next = { ...s, ...p };
    setS(next);
    try {
      await saveSettings(p);
    } catch (e: any) {
      setS(s);
      toast.error(e?.message ?? "Couldn't save");
    }
  };

  const togglePride = async (v: boolean) => {
    setPride(v);
    try {
      await setPrideOptIn(v);
      toast.success(v ? "Pride section enabled" : "Pride section hidden");
    } catch (e: any) {
      setPride(!v);
      toast.error(e?.message ?? "Couldn't save");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const deactivate = async () => {
    if (!confirm("Deactivate your account? Your profile and content will be hidden until you log back in.")) return;
    setBusy(true);
    try {
      await saveSettings({ deactivated_at: new Date().toISOString() });
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't deactivate");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await doDelete({ data: undefined });
      await supabase.auth.signOut();
      toast.success("Your account has been deleted");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete your account");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const push = s?.push_enabled ?? true;

  return (
    <SettingsShell title="Settings">
      <SectionTitle>Account</SectionTitle>
      <Card>
        <Row title="Change phone number" subtitle="Re-verify with your password" onClick={() => navigate({ to: "/settings/phone" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <Row title="Change password" onClick={() => navigate({ to: "/settings/password" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <Row title="Linked accounts" subtitle="Google and Apple sign-in — coming soon" right={<span className="text-xs text-muted-foreground">Soon</span>} />
      </Card>

      <SectionTitle>Privacy &amp; Safety</SectionTitle>
      <Card>
        <Row
          title="Show Pride section"
          subtitle="Private LGBTQ+ space for organizing house parties & social events. This choice is private — never shown on your profile or to other users."
          right={<Toggle label="Show Pride section" checked={pride} onChange={togglePride} />}
        />
        <Row title="Blocked users" onClick={() => navigate({ to: "/settings/blocked" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <Row
          title="Who can send me Linkup requests"
          right={
            <select
              value={s?.linkup_privacy ?? "everyone"}
              onChange={(e) => patch({ linkup_privacy: e.target.value as any })}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="everyone">Everyone</option>
              <option value="no_one">No one</option>
            </select>
          }
        />
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <Row
          title="Push notifications"
          subtitle="Turn off to mute everything below"
          right={<Toggle label="Push notifications" checked={push} onChange={(v) => togglePush(v)} />}
        />
        {([
          ["notify_likes", "Likes"],
          ["notify_comments", "Comments"],
          ["notify_join_requests", "Join requests"],
          ["notify_messages", "Messages"],
          ["notify_linkups", "Linkup requests"],
        ] as const).map(([key, label]) => (
          <Row
            key={key}
            title={label}
            right={
              <Toggle
                label={label}
                disabled={!push}
                checked={push && (s?.[key] ?? true)}
                onChange={(v) => patch({ [key]: v } as any)}
              />
            }
          />
        ))}
      </Card>

      <SectionTitle>Subscription</SectionTitle>
      <Card>
        <Row title="Manage subscription" subtitle="Plan, renewal date and cancellation" onClick={() => navigate({ to: "/subscription" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
      </Card>

      <SectionTitle>Support &amp; Legal</SectionTitle>
      <Card>
        <Row title="Help & FAQ" onClick={() => navigate({ to: "/settings/help" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <Row title="Report a problem" onClick={() => navigate({ to: "/settings/report" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <Row title="Privacy Policy" onClick={() => navigate({ to: "/settings/privacy" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <Row title="Terms of Service" onClick={() => navigate({ to: "/settings/terms" })} right={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <a href={`mailto:${SUPPORT_EMAIL}`} className="block hover:bg-muted/50 transition">
          <Row title="Contact us" subtitle={SUPPORT_EMAIL} right={<Mail className="h-4 w-4 text-muted-foreground" />} />
        </a>
      </Card>

      <SectionTitle>Account actions</SectionTitle>
      <Card>
        <Row title="Deactivate account" subtitle="Temporarily hide your profile and content. Log back in any time to reactivate." onClick={deactivate} />
        <Row title="Delete account" subtitle="Permanent. Your profile, posts, events and messages will be erased." danger onClick={() => setConfirmDelete(true)} />
        <Row title="Log out" onClick={signOut} />
      </Card>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold">Delete your account?</div>
            <p className="mt-2 text-sm text-muted-foreground">
              This can't be undone. Your profile, photos, posts, events, Linkups and messages
              will be permanently erased from Gathr.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full border border-border py-2.5 text-sm font-medium">
                Cancel
              </button>
              <button onClick={remove} disabled={busy} className="flex-1 rounded-full bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50">
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
