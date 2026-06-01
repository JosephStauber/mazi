/**
 * Allowed raster image types for user uploads. SVG is deliberately excluded:
 * it can carry scripts and, served from a public bucket, becomes stored XSS.
 */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface ValidatedImage {
  /** Safe, server-derived file extension (never from the user's filename). */
  ext: string;
  /** MIME type to persist so the object is served with a safe content-type. */
  contentType: string;
}

/**
 * Validate an uploaded file by its declared MIME type. Returns a safe
 * extension/content-type, or an error message. We trust `file.type` enough to
 * reject obvious abuse (HTML/SVG/scripts); the extension is derived from the
 * MIME, not the attacker-controlled filename.
 */
export function validateImageUpload(
  file: File
): { ok: true; value: ValidatedImage } | { ok: false; error: string } {
  const type = (file.type || "").toLowerCase();
  const ext = ALLOWED[type];
  if (!ext) {
    return {
      ok: false,
      error: "Unsupported file type. Use JPEG, PNG, WebP, or GIF.",
    };
  }
  return { ok: true, value: { ext, contentType: type } };
}
