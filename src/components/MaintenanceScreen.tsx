import { Wrench } from "lucide-react";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/admin";

/** Shown to every non-admin user while Maintenance Mode is ON. */
export function MaintenanceScreen({ message }: { message?: string | null }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center bg-background">
      <div className="h-16 w-16 rounded-full bg-gradient-brand flex items-center justify-center shadow-glow">
        <Wrench className="h-7 w-7 text-white" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">We'll be back soon</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        {message?.trim() || DEFAULT_MAINTENANCE_MESSAGE}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-7 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
