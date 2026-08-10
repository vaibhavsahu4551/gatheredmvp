import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

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
      { title: "Gathr — Meet verified strangers, plan real hangouts" },
      { name: "description", content: "Gathr is a group-only meetup app for verified 18+ users to plan gaming, coffee, dinner, movies, treks and evening hangouts together." },
      { name: "theme-color", content: "#6B2C91" },
      { property: "og:title", content: "Gathr — Meet verified strangers, plan real hangouts" },
      { property: "og:description", content: "Gathr is a group-only meetup app for verified 18+ users to plan gaming, coffee, dinner, movies, treks and evening hangouts together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Gathr — Meet verified strangers, plan real hangouts" },
      { name: "twitter:description", content: "Gathr is a group-only meetup app for verified 18+ users to plan gaming, coffee, dinner, movies, treks and evening hangouts together." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/950d8335-a2a5-4bc0-823e-e75487d32073/id-preview-9f737dfc--ce839c12-d248-4974-aa6d-41389271320c.lovable.app-1784294960190.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/950d8335-a2a5-4bc0-823e-e75487d32073/id-preview-9f737dfc--ce839c12-d248-4974-aa6d-41389271320c.lovable.app-1784294960190.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-180.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Baloo+2:wght@700;800&display=swap" },
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
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
