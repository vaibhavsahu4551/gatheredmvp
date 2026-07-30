import { createFileRoute } from "@tanstack/react-router";
import { SettingsShell } from "@/components/SettingsUI";
import { SUPPORT_EMAIL } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/_app/settings/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Gathr" },
      { name: "description", content: "The rules for using Gathr and joining events with other members." },
      { property: "og:title", content: "Terms of Service — Gathr" },
      { property: "og:description", content: "The rules for using Gathr and joining events with other members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <SettingsShell title="Terms of Service">
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground pb-10">
        <p className="text-xs uppercase tracking-wide font-semibold text-foreground">Placeholder content</p>
        <p>This is placeholder text and will be replaced with Gathr's full terms of service.</p>
        <p>
          <span className="font-semibold text-foreground">Eligibility.</span> Gathr is for
          people aged 18 and over.
        </p>
        <p>
          <span className="font-semibold text-foreground">Community conduct.</span> Be
          respectful, show up when you say you will, and don't harass, impersonate or endanger
          other members. Accounts that break these rules can be suspended or removed.
        </p>
        <p>
          <span className="font-semibold text-foreground">Meeting in person.</span> Gathr does
          not vet the events members create. Use your judgement, meet in public where possible
          and report anything that feels unsafe.
        </p>
        <p>
          <span className="font-semibold text-foreground">Subscriptions.</span> Gathr Premium
          renews monthly until cancelled. You keep access until the end of the paid cycle.
        </p>
        <p>
          Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary">{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </SettingsShell>
  );
}
