import { useEffect, useState } from "react";
import { signedPhotoUrl } from "@/lib/huddl";

const cache = new Map<string, string>();

export function Avatar({
  photo,
  name,
  size = 40,
  className = "",
}: {
  photo?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string>(() => (photo && cache.get(photo)) || "");

  useEffect(() => {
    let alive = true;
    if (!photo) { setUrl(""); return; }
    if (cache.has(photo)) { setUrl(cache.get(photo)!); return; }
    signedPhotoUrl(photo).then((u) => {
      if (!alive) return;
      if (u) cache.set(photo, u);
      setUrl(u);
    }).catch(() => {});
    return () => { alive = false; };
  }, [photo]);

  const initials = (name ?? "").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div
      className={`rounded-full overflow-hidden bg-gradient-brand shrink-0 flex items-center justify-center text-white font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initials || "·"}</span>
      )}
    </div>
  );
}
