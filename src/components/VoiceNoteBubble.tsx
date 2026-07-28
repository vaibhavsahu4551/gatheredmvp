import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { signedVoiceUrl } from "@/lib/voice";

type Props = { path: string; durationMs?: number | null; mine?: boolean };

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function VoiceNoteBubble({ path, durationMs, mine }: Props) {
  const [url, setUrl] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState((durationMs ?? 0) / 1000);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = async () => {
    if (!url) {
      setLoading(true);
      try { setUrl(await signedVoiceUrl(path)); } finally { setLoading(false); }
      return;
    }
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { await a.play().catch(() => {}); }
  };

  useEffect(() => {
    if (!url) return;
    const a = new Audio(url);
    audioRef.current = a;
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.onended = () => { setPlaying(false); setCur(0); };
    a.ontimeupdate = () => setCur(a.currentTime);
    a.onloadedmetadata = () => { if (isFinite(a.duration)) setDur(a.duration); };
    a.play().catch(() => {});
    return () => { a.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  const barBg = mine ? "bg-white/25" : "bg-foreground/10";
  const barFg = mine ? "bg-white" : "bg-primary";

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <button
        onClick={toggle}
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${mine ? "bg-white/25 text-white" : "bg-primary text-primary-foreground"}`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className={`h-1.5 rounded-full ${barBg} overflow-hidden`}>
          <div className={`h-full ${barFg} transition-[width]`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className={`text-[11px] tabular-nums ${mine ? "text-white/80" : "text-muted-foreground"}`}>
        {fmt(playing || cur > 0 ? cur : dur)}
      </div>
    </div>
  );
}
