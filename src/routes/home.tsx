import { createFileRoute } from "@tanstack/react-router";
import { HomeFeed } from "@/components/HomeFeed";

const GATHR_SHARE_IMAGE = "https://gathrmeet.in/__l5e/assets-v1/9a99cb0a-7c14-4be1-8f90-90cbb85b6876/gathr-social-share.jpg";

export const Route = createFileRoute("/home")({
  component: HomeFeed,
  head: () => ({
    meta: [
      { title: "Gathr – Discover, Create & Join Meetups & Events" },
      { name: "description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { property: "og:title", content: "Gathr – Discover, Create & Join Meetups & Events" },
      { property: "og:description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gathrmeet.in/home" },
      { property: "og:site_name", content: "Gathr" },
      { property: "og:image", content: GATHR_SHARE_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:alt", content: "Gathr — discover and join meetups and events" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Gathr – Discover, Create & Join Meetups & Events" },
      { name: "twitter:description", content: "Gathr is a meetup and event platform where you can discover events, create your own meetup, and join plans happening around you." },
      { name: "twitter:image", content: GATHR_SHARE_IMAGE },
      { name: "twitter:image:alt", content: "Gathr — discover and join meetups and events" },
    ],
    links: [{ rel: "canonical", href: "https://gathrmeet.in/home" }],
  }),
});
