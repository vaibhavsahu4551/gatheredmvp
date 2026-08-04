import { Instagram, Music2, Twitter } from "lucide-react";
import { instagramUrl, xUrl } from "@/lib/socials";

export function SocialLinks({
  instagram,
  spotify,
  x,
  className = "",
}: {
  instagram?: string | null;
  spotify?: string | null;
  x?: string | null;
  className?: string;
}) {
  if (!instagram && !spotify && !x) return null;
  const cls =
    "h-10 w-10 rounded-full border border-border bg-background flex items-center justify-center hover:bg-muted transition";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {instagram && (
        <a href={instagramUrl(instagram)} target="_blank" rel="noreferrer noopener" aria-label="Instagram" className={cls}>
          <Instagram className="h-4.5 w-4.5" />
        </a>
      )}
      {x && (
        <a href={xUrl(x)} target="_blank" rel="noreferrer noopener" aria-label="X" className={cls}>
          <Twitter className="h-4.5 w-4.5" />
        </a>
      )}
      {spotify && (
        <a href={spotify} target="_blank" rel="noreferrer noopener" aria-label="Spotify" className={cls}>
          <Music2 className="h-4.5 w-4.5" />
        </a>
      )}
    </div>
  );
}
