import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { uploadVoiceNote, MAX_VOICE_MS } from "@/lib/voice";

type Props = {
  onSent: (path: string, durationMs: number) => Promise<void> | void;
  disabled?: boolean;
};

function pickMime(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const t of types) if ((window as any).MediaRecorder?.isTypeSupported?.(t)) return t;
  return "";
}

export function VoiceRecorder({ onSent, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice notes aren't supported on this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Enable it in your browser settings.");
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = async () => {
      const durationMs = Math.min(MAX_VOICE_MS, Date.now() - startRef.current);
      cleanup();
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 500) return;
      setUploading(true);
      try {
        const path = await uploadVoiceNote(blob);
        await onSent(path, durationMs);
      } catch (e: any) {
        setError(e?.message ?? "Failed to send voice note");
      } finally {
        setUploading(false);
      }
    };
    recRef.current = rec;
    startRef.current = Date.now();
    setElapsed(0);
    rec.start();
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 200);
    stopTimerRef.current = window.setTimeout(() => {
      if (recRef.current?.state === "recording") recRef.current.stop();
    }, MAX_VOICE_MS);
  };

  const stop = () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
  };

  const cancel = () => {
    chunksRef.current = [];
    if (recRef.current?.state === "recording") {
      recRef.current.onstop = null as any;
      recRef.current.stop();
    }
    cleanup();
    setRecording(false);
  };

  if (uploading) {
    return (
      <button disabled className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (recording) {
    const mm = Math.floor(elapsed / 60);
    const ss = (elapsed % 60).toString().padStart(2, "0");
    return (
      <div className="flex items-center gap-2">
        <button onClick={cancel} className="text-xs text-muted-foreground px-2">Cancel</button>
        <div className="flex items-center gap-1.5 px-3 h-10 rounded-full bg-red-500/10 text-red-600 text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          {mm}:{ss}
        </div>
        <button
          onClick={stop}
          className="h-10 w-10 rounded-full bg-gradient-brand text-white flex items-center justify-center"
          aria-label="Stop recording"
        >
          <Square className="h-4 w-4" fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={start}
        disabled={disabled}
        className="h-10 w-10 rounded-full bg-muted flex items-center justify-center disabled:opacity-50"
        aria-label="Record voice note"
      >
        <Mic className="h-4 w-4" />
      </button>
      {error && (
        <div className="absolute bottom-16 right-3 max-w-[70vw] rounded-xl bg-background border border-border shadow-md px-3 py-2 text-xs text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
