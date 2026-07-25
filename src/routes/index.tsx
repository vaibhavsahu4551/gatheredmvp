import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "HUDDL — 18+ verified group meetups near you" },
      { name: "description", content: "Coffee, dinner, drinks, gaming, treks — plan real hangouts with verified people who actually show up." },
      { property: "og:title", content: "HUDDL — meet strangers, plan real hangouts" },
      { property: "og:description", content: "Group-only meetups for 18+ verified people. Coffee, dinner, drinks, gaming, treks and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[70vh] -z-10" style={{ backgroundImage: "var(--gradient-brand)" }} />
      <div aria-hidden className="absolute inset-x-0 top-[60vh] h-40 -z-10 bg-gradient-to-b from-transparent to-background" />

      <header className="px-6 pt-8 flex items-center justify-between">
        <div className="text-lg font-black tracking-tight text-white">[HUDDL]</div>
        <Link to="/auth" className="text-sm font-semibold text-white/90 hover:text-white">
          Sign in
        </Link>
      </header>

      <main className="px-6 pt-10 pb-10 max-w-md mx-auto w-full relative">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-[11px] font-semibold text-white">
          <ShieldCheck className="h-3.5 w-3.5" /> Verified · 18+ only
        </div>
        <h1 className="mt-5 text-[42px] font-bold tracking-tight leading-[1.02] text-white drop-shadow-sm">
          Meet strangers.<br />Plan real<br />hangouts.
        </h1>
        <p className="mt-4 text-[15px] text-white/90 leading-relaxed max-w-sm">
          HUDDL is a group-only meetup app. Coffee, gaming, dinner, movies, treks —
          plan it together with people who actually show up.
        </p>

        <div className="relative z-10 -mb-8 mt-8">
          <Link
            to="/auth"
            className="flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-[15px] font-bold text-gradient-brand shadow-elevated active:scale-[0.99] transition"
          >
            Get started — it's free
          </Link>
          <p className="mt-3 text-center text-xs text-black font-medium">
            By continuing you confirm you are 18 or older.
          </p>
        </div>
      </main>

      <section className="px-6 pb-10 pt-14 max-w-md mx-auto w-full bg-background rounded-t-3xl relative z-0">
        <div className="space-y-3">
          <Feature icon={<Users className="h-4 w-4" />} title="Groups, not 1:1s" body="Every event is a small group, so nobody's stuck alone." />
          <Feature icon={<Sparkles className="h-4 w-4" />} title="Interest-first" body="Match on what you want to do, not just who you are." />
        </div>
      </section>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white/90 backdrop-blur p-4 shadow-card">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-white">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[13px] text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
