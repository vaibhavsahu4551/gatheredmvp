import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, ShieldCheck, EyeOff, Flag } from "lucide-react";
import { acceptPrideGuidelines, getPrideGuidelinesAck } from "@/lib/pride-extras";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/pride/guidelines")({
  head: () => ({
    meta: [
      { title: "Pride Community Guidelines · Gathr" },
      { name: "description", content: "How the Pride space on Gathr works: private, opt-in, respectful, and never linked to your real identity." },
      { property: "og:title", content: "Pride Community Guidelines · Gathr" },
      { property: "og:description", content: "A private, opt-in LGBTQ+ space with clear rules and anonymous reporting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrideGuidelines,
});

function PrideGuidelines() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPrideGuidelinesAck().then(setAccepted).catch(() => {}); }, []);

  const agree = async () => {
    setBusy(true);
    try {
      await acceptPrideGuidelines();
      navigate({ to: "/pride", replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/pride" })} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold tracking-tight flex-1">Pride Community Guidelines</h1>
      </header>

      <div className="px-5 pt-5 max-w-md mx-auto space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-500 p-4 text-white shadow-glow">
          <div className="flex items-center gap-2 font-semibold"><Heart className="h-4 w-4" /> A space that belongs to you</div>
          <p className="mt-1 text-xs opacity-90">Private, opt-in, and built around consent. Please read this once before you come in.</p>
        </div>

        <Item icon={<EyeOff className="h-4 w-4" />} title="Your real identity stays out">
          Everything you do here uses your Pride identity only. Your real name, photos, and main profile
          are never shown in Pride, and nobody — including other members — sees the link between them.
        </Item>
        <Item icon={<ShieldCheck className="h-4 w-4" />} title="No nudity or explicit content">
          Photos are automatically checked before they're posted. Sexual or explicit content is removed,
          and repeat uploads lose access to Pride.
        </Item>
        <Item icon={<Heart className="h-4 w-4" />} title="Respect is the baseline">
          No harassment, outing, slurs, screenshots, or pressuring anyone. Meet people the way you'd want
          to be met. Exact meeting points are shared only after the host approves you.
        </Item>
        <Item icon={<Flag className="h-4 w-4" />} title="Reporting is anonymous">
          Report or block anyone at any time. The other person is never told. Every Pride event page and
          chat also has a quick-exit button.
        </Item>

        {accepted ? (
          <p className="text-xs text-muted-foreground text-center pt-2">
            You agreed to these guidelines on {new Date(accepted).toLocaleDateString()}.
          </p>
        ) : (
          <button
            onClick={agree}
            disabled={busy}
            className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            I understand and agree
          </button>
        )}
      </div>
    </div>
  );
}

function Item({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 font-semibold text-sm">{icon}{title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
