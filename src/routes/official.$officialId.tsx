import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/official/$officialId")({
  component: () => <Outlet />,
});
