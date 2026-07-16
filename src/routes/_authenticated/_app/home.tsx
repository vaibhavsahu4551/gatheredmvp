import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/home")({
  component: HomeFeed,
});

const MOCK = [
  { title: "Sunday morning coffee run", tag: "Coffee", when: "Sun 9:30 AM", where: "Third Wave, Indiranagar", going: 3, cap: 6 },
  { title: "Casual Valorant 5-stack", tag: "Gaming", when: "Tonight 10 PM", where: "Online", going: 4, cap: 5 },
  { title: "New A24 movie + dinner", tag: "Movies", where: "PVR Orion", when: "Fri 7 PM", going: 2, cap: 8 },
  { title: "Sunrise trek — Skandagiri", tag: "Trekking", where: "Meet at Hebbal", when: "Sat 4 AM", going: 5, cap: 10 },
];

function HomeFeed() {
  return (
    <div>
      <header className="px-5 pt-8 pb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Bengaluru</div>
          <h1 className="text-2xl font-semibold tracking-tight">Happening near you</h1>
        </div>
        <button className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Search className="h-5 w-5" />
        </button>
      </header>

      <div className="px-5 flex gap-2 overflow-x-auto pb-2 -mx-1">
        {["All", "Coffee", "Gaming", "Dinner", "Movies", "Trekking", "Sports", "Party"].map((t, i) => (
          <button key={t} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium border ${i === 0 ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      <div className="mt-3 px-5 space-y-3">
        {MOCK.map((e, i) => (
          <article key={i} className="rounded-2xl border border-border p-4 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{e.tag}</span>
              <span className="text-[11px] text-muted-foreground">{e.when}</span>
            </div>
            <h3 className="mt-1.5 text-[17px] font-semibold leading-snug">{e.title}</h3>
            <div className="mt-1 text-[13px] text-muted-foreground">{e.where}</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {e.going}/{e.cap} going
              </div>
              <button className="rounded-full bg-foreground text-background text-[13px] font-medium px-4 py-1.5">Join</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
