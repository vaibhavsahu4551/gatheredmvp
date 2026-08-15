import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { joinCircleByCode } from "@/lib/circles";

export const Route = createFileRoute("/_authenticated/_app/circles/join/$code")({
  component: JoinCircle,
});

function JoinCircle() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    joinCircleByCode(code)
      .then((circleId) => {
        if (!alive) return;
        navigate({ to: "/circles/$circleId", params: { circleId } });
      })
      .catch((e: any) => { if (alive) setError(e?.message ?? "That invite link isn't valid."); });
    return () => { alive = false; };
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-gradient-brand-soft flex items-center justify-center">
          <Users className="h-6 w-6 text-[color:var(--brand)]" />
        </div>
        {error ? (
          <>
            <h1 className="mt-4 text-lg font-semibold">Couldn't join this circle</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate({ to: "/circles" })}
              className="mt-5 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium"
            >
              Go to Circles
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-lg font-semibold">Joining circle…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Hang tight, adding you now.</p>
          </>
        )}
      </div>
    </div>
  );
}
