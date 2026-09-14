import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/rewards";

export const Route = createFileRoute("/")({
  ssr: false,
  component: EntryRedirect,
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

function EntryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    captureReferralFromUrl();
    navigate({ to: "/home", replace: true });
  }, [navigate]);

  return null;
}
