import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  /** Output width in px. */
  size?: number;
  /** Crop aspect ratio (width / height). 1 = square. */
  aspect?: number;
  /** Circular mask (avatars). Set false for banners. */
  round?: boolean;
  /** Header label. */
  title?: string;
};

/** Circular crop tool: pan by dragging, zoom with the slider / wheel / pinch. */
export function PhotoCropModal({
  file,
  onCancel,
  onConfirm,
  size = 720,
  aspect = 1,
  round = true,
  title = "Adjust your photo",
}: Props) {
  const [src, setSrc] = useState<string>("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Non-passive wheel so the page doesn't scroll while zooming.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setZoom((z) => clamp(z * Math.exp(-dy * 0.0015), 1, 4));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [img]);

  const viewportW = 288; // px, matches the on-screen crop box
  const viewportH = Math.round(viewportW / aspect);
  const outW = size;
  const outH = Math.round(size / aspect);
  const baseScale = (i: HTMLImageElement) => Math.max(viewportW / i.width, viewportH / i.height);

  function clampOffset(next: { x: number; y: number }, z: number) {
    if (!img) return next;
    // base scale = cover the viewport
    const base = baseScale(img);
    const w = img.width * base * z;
    const h = img.height * base * z;
    const maxX = Math.max(0, (w - viewportW) / 2);
    const maxY = Math.max(0, (h - viewportH) / 2);
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }

  useEffect(() => {
    setOffset((o) => clampOffset(o, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, img]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = drag.current;
    setOffset(clampOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }, zoom));
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (!pinch.current) pinch.current = { dist, zoom };
    else setZoom(clamp((pinch.current.zoom * dist) / pinch.current.dist, 1, 4));
  }

  async function confirm() {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      const ratio = outW / viewportW;
      const base = baseScale(img);
      const w = img.width * base * zoom * ratio;
      const h = img.height * base * zoom * ratio;
      const x = outW / 2 - w / 2 + offset.x * ratio;
      const y = outH / 2 - h / 2 + offset.y * ratio;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, x, y, w, h);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
      if (!blob) throw new Error("Couldn't process the image");
      onConfirm(new File([blob], round ? "avatar.jpg" : "cover.jpg", { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }

  const base = img ? baseScale(img) : 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onCancel} aria-label="Cancel" className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{title}</span>
        <span className="w-9" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div
          ref={boxRef}
          className={`relative overflow-hidden touch-none bg-black select-none ${round ? "rounded-full" : "rounded-xl"}`}
          style={{ width: viewportW, height: viewportH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchMove={onTouchMove}
          onTouchEnd={() => (pinch.current = null)}
        >
          {src && img && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: img.width * base * zoom,
                height: img.height * base * zoom,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          <div className={`pointer-events-none absolute inset-0 ring-2 ring-white/70 ${round ? "rounded-full" : "rounded-xl"}`} />
        </div>

        <div className="mt-6 w-full max-w-xs flex items-center gap-3 text-white/80">
          <span className="text-xs">−</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-white"
            aria-label="Zoom"
          />
          <span className="text-xs">+</span>
        </div>
        <p className="mt-3 text-xs text-white/60">Drag to reposition · pinch or scroll to zoom</p>
      </div>

      <div className="p-5 pb-8">
        <button
          onClick={confirm}
          disabled={!img || busy}
          className="w-full rounded-full bg-gradient-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Use photo"}
        </button>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
