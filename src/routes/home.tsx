import { createFileRoute } from "@tanstack/react-router";
import { HomeFeed } from "./_authenticated/_app/home";

export const Route = createFileRoute("/home")({
  component: HomeFeed,
});
