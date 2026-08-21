import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin } from "lucide-react";

type Props = {
  lat: number | null;
  lng: number | null;
  /** When set, the map is interactive and reports the picked point. */
  onPick?: (lat: number, lng: number) => void;
  /** Show a fuzzy area circle instead of an exact pin. */
  approximate?: boolean;
  height?: number;
  className?: string;
};

const DEFAULT: [number, number] = [12.9716, 77.5946]; // Bengaluru

/**
 * Leaflet + OpenStreetMap. Leaflet is browser-only, so it is imported
 * dynamically inside an effect — never at module scope.
 */
export function LocationMap({ lat, lng, onPick, approximate = false, height = 180, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      LRef.current = L;
      const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT;
      const map = L.map(ref.current, {
        center,
        zoom: lat != null ? (approximate ? 13 : 15) : 11,
        zoomControl: !!onPickRef.current,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      if (onPickRef.current) {
        map.on("click", (e: any) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
      } else {
        map.dragging.disable();
        map.doubleClickZoom.disable();
      }
      setTimeout(() => map.invalidateSize(), 60);
      draw();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove?.();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (lat == null || lng == null) return;
    if (approximate) {
      layerRef.current = L.circle([lat, lng], {
        radius: 600,
        color: "#e11d74",
        weight: 2,
        fillColor: "#e11d74",
        fillOpacity: 0.15,
      }).addTo(map);
    } else {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#e11d74;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      layerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }
    map.setView([lat, lng], approximate ? 13 : 15);
  };

  useEffect(draw, [lat, lng, approximate]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onPickRef.current?.(pos.coords.latitude, pos.coords.longitude);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className={className}>
      <div
        ref={ref}
        style={{ height }}
        className="w-full rounded-2xl overflow-hidden border border-border z-0"
      />
      {onPick && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Tap the map to drop a pin
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium flex items-center gap-1"
          >
            <Crosshair className="h-3 w-3" /> {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
      )}
    </div>
  );
}
