const MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;
const SKIP_THRESHOLD = 600 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  if (file.size < SKIP_THRESHOLD) return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/heic" || file.type === "image/heif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });

    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
