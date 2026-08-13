import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;

/** Pool of placeholder covers per event type — one is assigned at creation. */
export const COVER_POOL: Record<string, string[]> = {
  Breakfast: ["1509440159596-0249088772ff", "1533089860892-a7c6f0a88666", "1482049016688-2d3e1b311543", "1525351484163-7529414344d8", "1494859802809-d069c3b71a8a"].map(u),
  Lunch: ["1543353071-10c8ba85a904", "1512621776951-a57141f2eefd", "1540189549336-e6e99c3679fe", "1467003909585-2f8a72700288", "1476224203421-9ac39bcb3327"].map(u),
  Dinner: ["1414235077428-338989a2e8c0", "1552566626-52f8b828add9", "1555396273-367ea4eb4db5", "1517248135467-4c7edcad34c4", "1550966871-3ed3cdb5ed0c"].map(u),
  Drinks: ["1514362545857-3bc16c4c7d1b", "1470337458703-46ad1756a187", "1551024709-8f23befc6f87", "1544145945-f90425340c7e", "1536935338788-846bb9981813"].map(u),
  Club: ["1571266028243-e4bb35f9a1a1", "1470229722913-7ea0d339e46e", "1516450360452-9312f5e86fc7", "1493676304819-0d7a8d026dcf", "1533174072545-7a4b6ad7a6c3"].map(u),
  Gaming: ["1542751371-adc38448a05e", "1511512578047-dfb367046420", "1550745165-9bc0b252726f", "1493711662062-fa541adb3fc8", "1552820728-8b83bb6b773f"].map(u),
  Movies: ["1489599849927-2ee91cede3ba", "1517604931442-7e0c8ed2963c", "1536440136628-849c177e76a1", "1524985069026-dd778a71c7b4", "1478720568477-152d9b164e26", "1440404653325-ab127d49abc1"].map(u),
  Trek: ["1551632811-561732d1e306", "1464822759023-fed622ff2c3b", "1454496522488-7a8e488e8606", "1502082553048-f009c37129b9", "1519681393784-d120267933ba"].map(u),
  Other: ["1529156069898-49953e39b3ac", "1543269865-cbf427effbad", "1511632765486-a01980e01a18", "1496024840928-4c417adf211d", "1523580494863-6f3031224c94"].map(u),
};

export function pickPlaceholderCover(type?: string | null): string {
  const pool = COVER_POOL[type ?? "Other"] ?? COVER_POOL.Other;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Stable fallback for events created before covers were stored. */
export function fallbackCover(eventId: string, type?: string | null): string {
  const pool = COVER_POOL[type ?? "Other"] ?? COVER_POOL.Other;
  let h = 0;
  for (let i = 0; i < eventId.length; i++) h = (h * 31 + eventId.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

export function isRemoteCover(cover?: string | null) {
  return !!cover && /^https?:\/\//.test(cover);
}

export async function signedEventCoverUrl(path: string) {
  const { data } = await supabase.storage.from("event-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

/** Uploads a host's custom cover and returns the storage path. */
export async function uploadEventCover(userId: string, file: File) {
  const compressed = await compressImage(file, { maxDim: 1280, quality: 0.82 });
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("event-photos")
    .upload(path, compressed, { contentType: compressed.type });
  if (error) throw error;
  return path;
}
