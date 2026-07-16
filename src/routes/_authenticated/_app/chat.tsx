import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/chat")({
  component: Chat,
});

function Chat() {
  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Group chats unlock once you join a HUDDL.</p>
      </header>
      <div className="px-6 py-16 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">
          No conversations yet.
        </p>
      </div>
    </div>
  );
}
