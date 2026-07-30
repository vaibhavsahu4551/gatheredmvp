import { createFileRoute } from "@tanstack/react-router";
import { SettingsShell } from "@/components/SettingsUI";
import { SUPPORT_EMAIL } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/_app/settings/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Gathr" },
      { name: "description", content: "How Gathr collects, uses and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — Gathr" },
      { property: "og:description", content: "How Gathr collects, uses and protects your personal information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <SettingsShell title="Privacy Policy">
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground pb-10">
        <p className="text-xs uppercase tracking-wide font-semibold text-foreground">Placeholder content</p>
        <p>
          This is placeholder text and will be replaced with Gathr's full privacy policy.
        </p>
        <p>
          <span className="font-semibold text-foreground">What we collect.</span> Your phone
          number, profile details you add (name, age, city, bio, interests, photos) and the
          content you create such as events, posts, comments and messages.
        </p>
        <p>
          <span className="font-semibold text-foreground">How we use it.</span> To run the
          service — showing you nearby events and people, delivering notifications you've
          opted into, and keeping the community safe.
        </p>
        <p>
          <span className="font-semibold text-foreground">Your choices.</span> You can edit
          your profile, control notifications and Linkup requests in Settings, deactivate your
          account temporarily, or delete it permanently at any time.
        </p>
        <p>
          Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary">{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </SettingsShell>
  );
}
