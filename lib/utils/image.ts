/**
 * Allowed raster image types for user uploads. SVG is deliberately excluded:
 * it can carry scripts and, served from a public bucket, becomes stored XSS.
 */

/** Declared MIME types we accept, mapped to a safe canonical extension. */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  // Some browsers / OS pickers report the non-standard "image/jpg".
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Filename-extension fallback, mapped to a canonical content-type. Used only
 * when the browser reports an empty or unrecognized `file.type` (common with
 * drag-and-drop, some Safari/older-browser paths, or programmatic uploads).
 * Mapping back to a known image content-type keeps the served object safe.
 */
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const UNSUPPORTED = "Unsupported file type. Use JPEG, PNG, WebP, or GIF.";

export interface ValidatedImage {
  /** Safe, server-derived file extension (never from the user's filename). */
  ext: string;
  /** MIME type to persist so the object is served with a safe content-type. */
  contentType: string;
}

/**
 * Validate an uploaded file. We first trust `file.type` if it's an allowed
 * image MIME; otherwise we fall back to the filename extension (since some
 * browsers send an empty/vendor MIME for perfectly valid images). In both
 * cases the persisted content-type is a canonical image/* value, never the
 * raw filename — so HTML/SVG/script payloads can't be smuggled through.
 */
export function validateImageUpload(
  file: File
): { ok: true; value: ValidatedImage } | { ok: false; error: string } {
  const type = (file.type || "").trim().toLowerCase();

  // Primary path: a declared MIME we recognize.
  const extFromMime = MIME_TO_EXT[type];
  if (extFromMime) {
    return {
      ok: true,
      // Normalize the non-standard image/jpg to image/jpeg.
      value: { ext: extFromMime, contentType: EXT_TO_MIME[extFromMime] },
    };
  }

  // Fallback path: empty or unrecognized MIME — derive from the extension.
  const rawExt = (file.name || "").toLowerCase().split(".").pop() ?? "";
  const contentType = EXT_TO_MIME[rawExt];
  if (contentType) {
    return {
      ok: true,
      value: { ext: rawExt === "jpeg" ? "jpg" : rawExt, contentType },
    };
  }

  return { ok: false, error: UNSUPPORTED };
}
