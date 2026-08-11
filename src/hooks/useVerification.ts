import { useCallback, useEffect, useState } from "react";
import { loadMyVerification, UNVERIFIED, type MyVerification } from "@/lib/verification";

/** Face-match verification state for the signed-in member. */
export function useVerification() {
  const [v, setV] = useState<MyVerification>(UNVERIFIED);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setV(await loadMyVerification());
    } catch {
      /* keep last known state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadMyVerification()
      .then((r) => alive && setV(r))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { ...v, loading, isVerified: v.status === "verified", refresh };
}
