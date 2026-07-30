import { createFileRoute } from "@tanstack/react-router";
import { SettingsShell } from "@/components/SettingsUI";
import { SUPPORT_EMAIL } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/_app/settings/help")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — Gathr" },
      { name: "description", content: "Answers to common questions about events, Linkups and Gathr Premium." },
      { property: "og:title", content: "Help & FAQ — Gathr" },
      { property: "og:description", content: "Answers to common questions about events, Linkups and Gathr Premium." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Help,
});

const FAQ = [
  {
    q: "How do events get confirmed?",
    a: "An event is confirmed once enough approved members have joined to hit the host's minimum group size. Everyone approved then gets a group chat.",
  },
  {
    q: "What is a Linkup?",
    a: "A Linkup is a mutual connection. Once both people accept, you can message each other directly and share posts and events.",
  },
  {
    q: "Who can see my exact meeting point?",
    a: "Only approved members of an event can see the exact location. Everyone else sees the general area.",
  },
  {
    q: "What does Gathr Premium include?",
    a: "Priority visibility for the events you host, unlimited hosting and joining, attendee previews and advanced search filters.",
  },
];

function Help() {
  return (
    <SettingsShell title="Help & FAQ">
      <div className="space-y-3">
        {FAQ.map((f) => (
          <div key={f.q} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-[15px] font-semibold">{f.q}</div>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </div>
        ))}
        <p className="pt-2 text-sm text-muted-foreground text-center">
          Still stuck? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary">{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </SettingsShell>
  );
}
