import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { captureReferralFromUrl } from "@/lib/rewards";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Splash,
  head: () => ({
    meta: [
      { title: "Gathr — meet, connect, gathr" },
      { name: "description", content: "Gathr is a group-only meetup app for 18+ verified people. Coffee, dinner, drinks, gaming, treks — plan real hangouts." },
      { property: "og:title", content: "Gathr — meet, connect, gathr" },
      { property: "og:description", content: "Group-only meetups for 18+ verified people. Plan real hangouts with people who show up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    captureReferralFromUrl();
    let alive = true;
    const started = Date.now();

    const go = (to: "/home" | "/auth") => {
      const wait = Math.max(0, 1600 - (Date.now() - started));
      setTimeout(() => { if (alive) navigate({ to }); }, wait);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => go(data.session ? "/home" : "/auth"))
      .catch(() => go("/auth"));

    return () => { alive = false; };
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
      style={{ backgroundImage: "var(--gradient-brand)" }}
    >
      <div className="animate-in fade-in zoom-in-95 duration-700">
        <h1 className="text-[64px] leading-none font-black tracking-[-0.045em] text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.25)]">
          Gathr
        </h1>
        <p className="mt-4 text-[15px] font-semibold tracking-[0.22em] uppercase text-white/85">
          Meet. Connect. Gathr.
        </p>
      </div>

      <div className="absolute bottom-12 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/30 animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}
