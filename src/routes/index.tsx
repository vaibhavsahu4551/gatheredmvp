import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/rewards";

export const Route = createFileRoute("/")({
  ssr: false,
  component: EntryRedirect,
  head: () => ({
    meta: [
      { title: "Gathr – Discover, Create & Join Meetups & Events" },
      { name: "description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { property: "og:title", content: "Gathr – Discover, Create & Join Meetups & Events" },
      { property: "og:description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gathrmeet.in/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Gathr – Discover, Create & Join Meetups & Events" },
      { name: "twitter:description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
    ],
    links: [{ rel: "canonical", href: "https://gathrmeet.in/" }],
  }),
});

function EntryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    captureReferralFromUrl();
    navigate({ to: "/home", replace: true });
  }, [navigate]);

  return null;
}
