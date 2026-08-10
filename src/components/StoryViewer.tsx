import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Trash2, Eye, Music, MapPin } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  deleteStory,
  listStoryViewers,
  markStoryViewed,
  signedStoryUrl,
  STORY_PHOTO_MS,
  type StoryGroup,
} from "@/lib/stories";
import { getProfilesLite } from "@/lib/events";

type Profiles = Record<string, { full_name: string | null; photo: string | null }>;

/** Full-screen story viewer: tap to advance, auto-advance, swipe down to close. */
export function StoryViewer({
  groups,
  startIndex,
  meId,
  profiles,
  onClose,
  onChanged,
  pride = false,
}: {
  groups: StoryGroup[];
  startIndex: number;
  meId: string;
  profiles: Profiles;
  onClose: () => void;
  onChanged: () => void;
  pride?: boolean;
}) {
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [mediaUrl, setMediaUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<{ viewer_id: string; created_at: string }[]>([]);
  const [viewerProfiles, setViewerProfiles] = useState<Profiles>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const group = groups[gi];
  const story = group?.stories[si];
  const isMine = story?.user_id === meId;

  const next = useCallback(() => {
    setViewersOpen(false);
    setProgress(0);
    if (!group) return onClose();
    if (si + 1 < group.stories.length) { setSi(si + 1); return; }
    if (gi + 1 < groups.length) { setGi(gi + 1); setSi(0); return; }
    onClose();
  }, [group, gi, si, groups.length, onClose]);

  const prev = useCallback(() => {
    setViewersOpen(false);
    setProgress(0);
    if (si > 0) { setSi(si - 1); return; }
    if (gi > 0) { const g = gi - 1; setGi(g); setSi(Math.max(0, groups[g].stories.length - 1)); return; }
  }, [gi, si, groups]);

  // Media + view tracking
  useEffect(() => {
    if (!story) return;
    let alive = true;
    setMediaUrl("");
    signedStoryUrl(story.media_path).then((u) => { if (alive) setMediaUrl(u); });
    markStoryViewed(story.id).catch(() => {});
    return () => { alive = false; };
  }, [story?.id]);

  // Background music clip (loops while the story is open)
  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (!story?.music_url) return;
    const a = new Audio(story.music_url);
    a.currentTime = (story.music_start_ms ?? 0) / 1000;
    const endSec = (story.music_end_ms ?? 15000) / 1000;
    const startSec = (story.music_start_ms ?? 0) / 1000;
    a.ontimeupdate = () => { if (a.currentTime >= endSec) a.currentTime = startSec; };
    a.play().catch(() => {});
    audioRef.current = a;
    return () => { a.pause(); };
  }, [story?.id, story?.music_url]);

  // Progress + auto advance
  useEffect(() => {
    if (!story || !mediaUrl) return;
    if (story.media_type === "video") return; // driven by the <video> element
    const started = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - started) / STORY_PHOTO_MS);
      setProgress(p);
      if (p >= 1) { next(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [story?.id, mediaUrl, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  async function openViewers() {
    if (!story) return;
    setViewersOpen(true);
    const v = await listStoryViewers(story.id);
    setViewers(v);
    // Inside Pride we never resolve real identities of viewers.
    if (!pride && v.length) setViewerProfiles(await getProfilesLite(v.map((x) => x.viewer_id)) as Profiles);
  }

  async function remove() {
    if (!story) return;
    await deleteStory(story.id, story.media_path);
    onChanged();
    onClose();
  }

  const owner = useMemo(() => profiles[story?.user_id ?? ""] ?? { full_name: "Someone", photo: null }, [profiles, story?.user_id]);
  if (!story) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black flex flex-col select-none"
      onTouchStart={(e) => { touchY.current = e.touches[0]?.clientY ?? null; }}
      onTouchEnd={(e) => {
        const start = touchY.current;
        const end = e.changedTouches[0]?.clientY ?? 0;
        touchY.current = null;
        if (start != null && end - start > 90) onClose();
      }}
    >
      <div className="px-3 pt-3 flex gap-1">
        {group.stories.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: i < si ? "100%" : i === si ? `${progress * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="px-4 py-3 flex items-center gap-3 text-white">
        <Avatar photo={owner.photo} name={owner.full_name} size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{isMine ? "Your story" : owner.full_name ?? "Someone"}</div>
          <div className="text-[11px] text-white/60">{timeAgo(story.created_at)}</div>
        </div>
        {isMine && (
          <button onClick={remove} aria-label="Delete story" className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {mediaUrl ? (
          story.media_type === "video" ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              playsInline
              muted={!!story.music_url}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
              }}
              onEnded={next}
              className="max-h-full max-w-full"
            />
          ) : (
            <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
          )
        ) : (
          <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        )}

        {/* tap zones */}
        <button aria-label="Previous" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" />
        <button aria-label="Next" onClick={next} className="absolute inset-y-0 right-0 w-2/3" />

        {story.text_overlay && (
          <div className="pointer-events-none absolute inset-x-6 bottom-28 text-center">
            <span className="inline-block rounded-2xl bg-black/45 px-4 py-2 text-white text-lg font-semibold leading-snug">
              {story.text_overlay}
            </span>
          </div>
        )}

        {story.music_title && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-white text-xs inline-flex items-center gap-1.5">
            <Music className="h-3 w-3" /> {story.music_title} · {story.music_artist}
          </div>
        )}
      </div>

      <div className="p-4 pb-8 space-y-2">
        {story.event_id && (
          <Link
            to="/events/$eventId"
            params={{ eventId: story.event_id }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/12 text-white px-3.5 py-2 text-sm font-medium"
          >
            <MapPin className="h-3.5 w-3.5" /> View tagged event
          </Link>
        )}
        {isMine && (
          <button onClick={openViewers} className="flex items-center gap-2 text-white/80 text-sm">
            <Eye className="h-4 w-4" /> Viewers
          </button>
        )}
        {story.music_attribution && (
          <p className="text-[10px] text-white/40">{story.music_attribution}</p>
        )}
      </div>

      {viewersOpen && (
        <div className="absolute inset-x-0 bottom-0 max-h-[60%] rounded-t-3xl bg-background p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Viewed by {viewers.length}</div>
            <button onClick={() => setViewersOpen(false)} className="text-sm text-muted-foreground">Close</button>
          </div>
          {!viewers.length && <div className="text-sm text-muted-foreground py-6 text-center">No views yet.</div>}
          {pride && !!viewers.length && (
            <p className="text-xs text-muted-foreground mb-3">
              Viewer names are hidden inside Pride to protect everyone's privacy.
            </p>
          )}
          <div className="space-y-3">
            {!pride && viewers.map((v) => (
              <div key={v.viewer_id} className="flex items-center gap-3">
                <Avatar photo={viewerProfiles[v.viewer_id]?.photo} name={viewerProfiles[v.viewer_id]?.full_name} size={36} />
                <div className="flex-1 text-sm">{viewerProfiles[v.viewer_id]?.full_name ?? "Someone"}</div>
                <div className="text-[11px] text-muted-foreground">{timeAgo(v.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
