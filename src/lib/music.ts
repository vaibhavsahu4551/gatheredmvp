// Curated royalty-free music library for Stories.
//
// Pixabay's public API only exposes images and videos (no audio search endpoint),
// and its audio CDN blocks hotlinking, so we ship a small curated library instead.
// These tracks are by Kevin MacLeod (incompetech.com), licensed CC BY 4.0 —
// attribution is REQUIRED and is rendered on every story that uses a track.

export type Track = {
  id: string;
  title: string;
  artist: string;
  url: string;
  /** Shown as the small music sticker / credit line on the story. */
  attribution: string;
  mood: string;
};

const CREDIT = (title: string) =>
  `"${title}" by Kevin MacLeod (incompetech.com) — CC BY 4.0`;

const t = (title: string, file: string, mood: string): Track => ({
  id: file,
  title,
  artist: "Kevin MacLeod",
  url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(file)}.mp3`,
  attribution: CREDIT(title),
  mood,
});

export const MUSIC_LIBRARY: Track[] = [
  t("Carefree", "Carefree", "Happy"),
  t("Wallpaper", "Wallpaper", "Chill"),
  t("Blippy Trance", "Blippy Trance", "Electronic"),
  t("Cheery Monday", "Cheery Monday", "Happy"),
  t("Life of Riley", "Life of Riley", "Upbeat"),
  t("Fretless", "Fretless", "Chill"),
  t("Monkeys Spinning Monkeys", "Monkeys Spinning Monkeys", "Playful"),
  t("Beach Bum", "Beach Bum", "Summer"),
  t("Pixel Peeker Polka", "Pixel Peeker Polka - faster", "Playful"),
  t("Hep Cats", "Hep Cats", "Jazz"),
  t("Local Forecast (Elevator)", "Local Forecast - Elevator", "Chill"),
  t("Feelin' Good", "Feelin Good", "Groovy"),
  t("Off to Osaka", "Off to Osaka", "World"),
  t("Danse Macabre", "Danse Macabre - Low Strings Finale", "Dramatic"),
];

export const MUSIC_CLIP_MS = 15_000;

export function searchTracks(q: string, library: Track[] = MUSIC_LIBRARY): Track[] {
  const s = q.trim().toLowerCase();
  if (!s) return library;
  return library.filter(
    (x) =>
      x.title.toLowerCase().includes(s) ||
      x.mood.toLowerCase().includes(s) ||
      x.artist.toLowerCase().includes(s),
  );
}

/**
 * Live library, managed by admins in the admin panel (Music Library).
 * Falls back to the bundled curated list if the table can't be read.
 */
export async function fetchTracks(): Promise<Track[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await (supabase as any)
    .from("music_tracks")
    .select("id, title, artist, category, attribution, url, active")
    .eq("active", true)
    .order("title");
  if (error || !data?.length) return MUSIC_LIBRARY;
  return (data as any[]).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    artist: r.artist as string,
    url: r.url as string,
    attribution: (r.attribution as string) ?? `"${r.title}" by ${r.artist}`,
    mood: (r.category as string) ?? "Other",
  }));
}

