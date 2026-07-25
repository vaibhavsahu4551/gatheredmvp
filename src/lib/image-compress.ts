// Client-side image downscaling + JPEG re-encoding.
// Keeps uploads reasonable (< ~400 KB) so storage + signed-URL bandwidth stay fast.

export async function compressImage(
  file: File,
  { maxDim = 1280, quality = 0.82 }: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file; // preserve animation

  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
