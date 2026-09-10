import { createFileRoute } from "@tanstack/react-router";
import { HomeFeed } from "@/components/HomeFeed";

export const Route = createFileRoute("/home")({
  component: HomeFeed,
});
