import { z } from "zod";

export const postContentSchema = z
  .string()
  .trim()
  .min(1, "Post cannot be empty")
  .max(2000, "Post must be at most 2000 characters");

/** Upload limits, enforced again server-side against the stored file's metadata. */
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
