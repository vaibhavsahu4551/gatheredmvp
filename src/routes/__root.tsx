import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav, useShowBottomNav } from "@/components/BottomNav";

const GATHR_SHARE_IMAGE = "https://gathrmeet.in/__l5e/assets-v1/9a99cb0a-7c14-4be1-8f90-90cbb85b6876/gathr-social-share.jpg";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-semibold tracking-tight">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again or head home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >Try again</button>
          <a href="/" className="rounded-full border px-5 py-2.5 text-sm font-medium">Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Gathr – Discover, Create & Join Meetups & Events" },
      { name: "description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { name: "theme-color", content: "#6B2C91" },
      { property: "og:title", content: "Gathr – Discover, Create & Join Meetups & Events" },
      { property: "og:description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gathrmeet.in/" },
      { property: "og:site_name", content: "Gathr" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Gathr – Discover, Create & Join Meetups & Events" },
      { name: "twitter:description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { property: "og:image", content: GATHR_SHARE_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:alt", content: "Gathr — discover and join meetups and events" },
      { name: "twitter:image", content: GATHR_SHARE_IMAGE },
      { name: "twitter:image:alt", content: "Gathr — discover and join meetups and events" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png", sizes: "64x64" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-180.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Baloo+2:wght@700;800&display=swap" },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Gathr",
          alternateName: "Gathr Meet",
          url: "https://gathrmeet.in/",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Gathr",
          url: "https://gathrmeet.in/",
          logo: "https://gathrmeet.in/icon-512.png",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <StartupGate>{children}</StartupGate>
        <Scripts />
      </body>
    </html>
  );
}

/** Keep all page and navigation components unmounted until startup finishes. */
function StartupGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"visible" | "fading" | "complete">("visible");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeTimer = window.setTimeout(() => setPhase("fading"), 1600);
    const completeTimer = window.setTimeout(() => setPhase("complete"), reducedMotion ? 1600 : 2000);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (phase === "complete") document.body.style.overflow = "";
  }, [phase]);

  if (phase === "complete") return children;

  return (
    <div className="startup-screen" role="status" aria-label="Loading Gathr">
      <div className={`startup-content ${phase === "fading" ? "startup-fading" : ""}`}>
        <div className="startup-wordmark">
          <h1>GATHR</h1>
        </div>
        <div className="startup-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const showNav = useShowBottomNav();
  return (
    <QueryClientProvider client={queryClient}>
      <div className={showNav ? "min-h-screen bg-background pb-24" : undefined}>
        <Outlet />
        {showNav && <BottomNav />}
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
