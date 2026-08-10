import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone, Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/pride/resources")({
  head: () => ({
    meta: [
      { title: "LGBTQ+ Support Resources in India · Gathr" },
      { name: "description", content: "Verified India-specific LGBTQ+ helplines, crisis support lines and community organisations." },
      { property: "og:title", content: "LGBTQ+ Support Resources in India · Gathr" },
      { property: "og:description", content: "Mental health helplines, crisis support and community organisations across India." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrideResources,
});

type Res = { name: string; what: string; phone?: string; hours?: string; site?: string };

const CRISIS: Res[] = [
  { name: "Tele-MANAS (Govt. of India)", what: "Free 24x7 national mental health helpline, multiple languages.", phone: "14416", hours: "24x7", site: "https://telemanas.mohfw.gov.in" },
  { name: "KIRAN Helpline (MoSJE)", what: "National toll-free mental health rehabilitation helpline.", phone: "1800-599-0019", hours: "24x7" },
  { name: "iCall (TISS)", what: "Free telephone and email counselling by trained counsellors.", phone: "9152987821", hours: "Mon–Sat, 10am–8pm", site: "https://icallhelpline.org" },
  { name: "Aasra", what: "Crisis intervention and suicide prevention helpline.", phone: "9820466726", hours: "24x7", site: "http://www.aasra.info" },
];

const QUEER: Res[] = [
  { name: "Sahodari Foundation", what: "Support and advocacy for transgender people.", site: "https://sahodari.org" },
  { name: "Humsafar Trust", what: "LGBTQ+ health, counselling and community services (Mumbai, national reach).", phone: "022-2667 3800", site: "https://humsafar.org" },
  { name: "Nazariya QFRG", what: "Queer feminist resource group; support for LBT+ people and families.", site: "https://nazariyaqfrg.in" },
  { name: "Sappho for Equality", what: "Support and helpline for LBT+ people (Kolkata).", phone: "033-2441 9995", site: "https://www.sapphokolkata.in" },
  { name: "Ya_All", what: "Youth-led queer and trans community org in Northeast India.", site: "https://yaall.org" },
  { name: "Naz Foundation (India) Trust", what: "HIV/AIDS care, sexual health and LGBTQ+ support.", site: "https://nazindia.org" },
];

function PrideResources() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/pride" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold tracking-tight flex-1">Resources &amp; helplines</h1>
      </header>

      <div className="px-5 pt-5 max-w-md mx-auto space-y-6">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          If you're in immediate danger, call 112. The services below are India-based and free or low
          cost. Gathr isn't affiliated with them — please check their current hours before calling.
        </p>
        <Section title="Mental health &amp; crisis support" items={CRISIS} />
        <Section title="LGBTQ+ community organisations" items={QUEER} />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Res[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.map((r) => (
        <div key={r.name} className="rounded-2xl border border-border p-4">
          <div className="text-sm font-semibold">{r.name}</div>
          <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{r.what}</p>
          {r.hours && <p className="mt-1 text-[11px] text-muted-foreground">{r.hours}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {r.phone && (
              <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
                <Phone className="h-3.5 w-3.5" /> {r.phone}
              </a>
            )}
            {r.site && (
              <a href={r.site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
                <Globe className="h-3.5 w-3.5" /> Website
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
