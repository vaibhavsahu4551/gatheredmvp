import { useEffect, useRef, useState } from "react";
import { X, Music, Type, MapPin, ImagePlus } from "lucide-react";
import { createStory, STORY_MAX_VIDEO_MS } from "@/lib/stories";
import { listMyEvents } from "@/lib/feed";
import { MusicPicker, type MusicChoice } from "@/components/MusicPicker";

/** Full-screen story composer: media, text overlay, event tag, background music. */
export function StoryCreator({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [music, setMusic] = useState<MusicChoice | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { listMyEvents().then((e: any[]) => setEvents(e.map((x) => ({ id: x.id, title: x.title })))).catch(() => {}); }, []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pick(f: File) {
    setErr(null);
    const isVideo = f.type.startsWith("video/");
    if (isVideo) {
      const ok = await checkDuration(f);
      if (!ok) { setErr("Videos must be 30 seconds or shorter."); return; }
    }
    setMediaType(isVideo ? "video" : "photo");
    setFile(f);
  }

  async function post() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await createStory({ file, mediaType, text, eventId: eventId || null, music });
      onPosted();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't post your story");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">New story</span>
        <span className="w-9" />
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!file ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-3 text-white/80"
          >
            <div className="h-20 w-20 rounded-full bg-gradient-brand flex items-center justify-center">
              <ImagePlus className="h-8 w-8 text-white" />
            </div>
            <span className="text-sm font-medium">Choose a photo or video</span>
            <span className="text-xs text-white/50">Videos up to 30 seconds</span>
          </button>
        ) : mediaType === "photo" ? (
          <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <video src={preview} className="max-h-full max-w-full" controls playsInline />
        )}

        {file && text && (
          <div className="absolute inset-x-6 bottom-28 text-center">
            <span className="inline-block rounded-2xl bg-black/45 px-4 py-2 text-white text-lg font-semibold leading-snug">{text}</span>
          </div>
        )}
        {music && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-white text-xs inline-flex items-center gap-1.5">
            <Music className="h-3 w-3" /> {music.title} · {music.artist}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.currentTarget.value = ""; }}
      />

      <div className="p-4 pb-8 space-y-3 bg-black">
        {file && (
          <>
            <div className="flex gap-2 overflow-x-auto">
              <Chip active={showText} onClick={() => setShowText((v) => !v)} icon={<Type className="h-3.5 w-3.5" />}>Text</Chip>
              <Chip active={!!music} onClick={() => setPickerOpen(true)} icon={<Music className="h-3.5 w-3.5" />}>{music ? "Music added" : "Add music"}</Chip>
              <Chip active={!!eventId} onClick={() => {}} icon={<MapPin className="h-3.5 w-3.5" />}>Tag event</Chip>
            </div>

            {showText && (
              <input
                value={text}
                maxLength={120}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a caption…"
                className="w-full rounded-2xl bg-white/10 text-white placeholder:text-white/40 px-4 py-3 text-sm"
              />
            )}

            {!!events.length && (
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full rounded-2xl bg-white/10 text-white px-4 py-3 text-sm"
              >
                <option value="" className="text-black">No event tagged</option>
                {events.map((e) => <option key={e.id} value={e.id} className="text-black">📍 {e.title}</option>)}
              </select>
            )}

            {music && (
              <p className="text-[11px] text-white/50">{music.attribution}</p>
            )}
          </>
        )}

        {err && <div className="text-xs text-red-400">{err}</div>}

        <button
          onClick={file ? post : () => inputRef.current?.click()}
          disabled={busy}
          className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Posting…" : file ? "Share story" : "Select media"}
        </button>
      </div>

      {pickerOpen && (
        <MusicPicker onClose={() => setPickerOpen(false)} onPick={(m) => { setMusic(m); setPickerOpen(false); }} />
      )}
    </div>
  );
}

function Chip({ children, icon, active, onClick }: { children: React.ReactNode; icon: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium ${active ? "bg-gradient-brand text-white" : "bg-white/10 text-white/80"}`}
    >
      {icon}{children}
    </button>
  );
}

function checkDuration(f: File): Promise<boolean> {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      res(!v.duration || v.duration * 1000 <= STORY_MAX_VIDEO_MS + 500);
    };
    v.onerror = () => res(true);
    v.src = URL.createObjectURL(f);
  });
}
