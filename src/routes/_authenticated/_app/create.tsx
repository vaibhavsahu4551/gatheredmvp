import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/create")({
  component: Create,
});

function Create() {
  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Create a HUDDL</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set the vibe and let people join.</p>
      </header>
      <div className="px-6 py-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">
          Event creation coming next. Phase 1 focuses on getting verified.
        </p>
      </div>
    </div>
  );
}
