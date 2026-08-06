import { useEffect, useRef, useState } from "react";
import { Play, Pause, Search, X, Check } from "lucide-react";
import { MUSIC_CLIP_MS, searchTracks, type Track } from "@/lib/music";

export type MusicChoice = {
  title: string;
  artist: string;
  url: string;
  startMs: number;
  endMs: number;
  attribution: string;
};

/** Searchable royalty-free track list with preview + 15s clip trimming. */
export function MusicPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (m: MusicChoice) => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Track | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0); // seconds
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const results = searchTracks(q);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function preview(track: Track, from = 0) {
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    if (playingId === track.id && !a.paused) {
      a.pause();
      setPlayingId(null);
      return;
    }
    if (a.src !== track.url) a.src = track.url;
    a.currentTime = from;
    a.play().then(() => setPlayingId(track.id)).catch(() => setPlayingId(null));
  }

  function choose(track: Track) {
    setSelected(track);
    setStart(0);
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    a.src = track.url;
    a.onloadedmetadata = () => setDuration(a.duration || 0);
    a.currentTime = 0;
    a.play().then(() => setPlayingId(track.id)).catch(() => {});
  }

  const clipSec = MUSIC_CLIP_MS / 1000;
  const maxStart = Math.max(0, duration - clipSec);

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">Add music</span>
        <button
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            audioRef.current?.pause();
            onPick({
              title: selected.title,
              artist: selected.artist,
              url: selected.url,
              startMs: Math.round(start * 1000),
              endMs: Math.round(start * 1000) + MUSIC_CLIP_MS,
              attribution: selected.attribution,
            });
          }}
          className="text-sm font-semibold text-gradient-brand disabled:opacity-40"
        >
          Done
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tracks or moods…"
            className="w-full rounded-full border border-border bg-muted/40 pl-9 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {results.map((tr) => {
          const active = selected?.id === tr.id;
          return (
            <div
              key={tr.id}
              className={`rounded-2xl border p-3 ${active ? "border-[color:var(--brand)] bg-gradient-brand-soft" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => preview(tr, active ? start : 0)}
                  aria-label={playingId === tr.id ? "Pause preview" : "Play preview"}
                  className="h-10 w-10 rounded-full bg-gradient-brand text-white flex items-center justify-center shrink-0"
                >
                  {playingId === tr.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button onClick={() => choose(tr)} className="flex-1 text-left">
                  <div className="text-sm font-semibold">{tr.title}</div>
                  <div className="text-xs text-muted-foreground">{tr.artist} · {tr.mood}</div>
                </button>
                {active && <Check className="h-4 w-4 text-[color:var(--brand)]" />}
              </div>

              {active && (
                <div className="mt-3">
                  <div className="text-[11px] text-muted-foreground mb-1">
                    Clip: {fmt(start)} – {fmt(Math.min(start + clipSec, duration || start + clipSec))}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.round(maxStart))}
                    step={1}
                    value={Math.min(start, maxStart)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setStart(v);
                      const a = audioRef.current;
                      if (a) { a.currentTime = v; a.play().then(() => setPlayingId(tr.id)).catch(() => {}); }
                    }}
                    className="w-full accent-[color:var(--brand)]"
                    aria-label="Clip start"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{tr.attribution}</p>
                </div>
              )}
            </div>
          );
        })}
        {!results.length && <div className="text-sm text-muted-foreground text-center py-10">No tracks match "{q}".</div>}
      </div>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
