import type { z } from "zod";
import { deny } from "./access";

/**
 * Run a shared Zod schema (lib/validators) on the server. Client-side checks
 * are UX only; these are the real limits.
 */
export function parseOrDeny<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) deny(parsed.error.issues[0]?.message ?? "Invalid input");
  return parsed.data;
}

/** Allowed raster types for uploads (SVG/HTML deliberately excluded). */
export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
