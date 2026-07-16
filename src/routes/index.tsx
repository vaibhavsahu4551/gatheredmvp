import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8 flex items-center justify-between">
        <div className="text-lg font-bold tracking-tight">[HUDDL]</div>
        <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Sign in
        </Link>
      </header>

      <main className="flex-1 px-6 pt-14 pb-10 max-w-md mx-auto w-full">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Verified 18+ only
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight leading-[1.05]">
          Meet strangers.<br />Plan real hangouts.
        </h1>
        <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
          HUDDL is a group-only meetup app. Coffee, gaming, dinner, movies, treks —
          plan it together with people who actually show up.
        </p>

        <div className="mt-8 space-y-3">
          <Feature icon={<Users className="h-4 w-4" />} title="Groups, not 1:1s" body="Every event is a small group, so nobody's stuck alone." />
          <Feature icon={<ShieldCheck className="h-4 w-4" />} title="ID + selfie verified" body="Every profile is reviewed before you see the feed." />
          <Feature icon={<Sparkles className="h-4 w-4" />} title="Interest-first" body="Match on what you want to do, not just who you are." />
        </div>

        <Link
          to="/auth"
          className="mt-10 flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-card active:scale-[0.99] transition"
        >
          Get started
        </Link>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          By continuing you confirm you're 18 or older.
        </p>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border p-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[13px] text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
