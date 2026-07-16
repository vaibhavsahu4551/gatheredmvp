import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/events")({
  component: Events,
});

function Events() {
  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
        <p className="mt-1 text-sm text-muted-foreground">Things you're joining or hosting.</p>
      </header>
      <EmptyState />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
        <Calendar className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">
        Nothing on the calendar yet. Join a HUDDL from Home or create one.
      </p>
    </div>
  );
}
