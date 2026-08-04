export function normalizeHandle(input: string): string | null {
  const v = input.trim().replace(/^@/, "").replace(/\s+/g, "");
  if (!v) return null;
  // Accept a pasted profile URL too.
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|x\.com|twitter\.com)\/([^/?#]+)/i);
  const handle = (m ? m[1] : v).replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return handle;
}

export function normalizeSpotify(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const url = v.startsWith("http") ? v : `https://${v}`;
  try {
    const u = new URL(url);
    if (!/(^|\.)spotify\.com$/.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const instagramUrl = (handle: string) => `https://instagram.com/${handle.replace(/^@/, "")}`;
export const xUrl = (handle: string) => `https://x.com/${handle.replace(/^@/, "")}`;
