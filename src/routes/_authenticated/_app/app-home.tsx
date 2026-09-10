import { createFileRoute } from "@tanstack/react-router";
import { HomeFeed } from "@/components/HomeFeed";

export const Route = createFileRoute("/_authenticated/_app/app-home")({
  component: HomeFeed,
});
