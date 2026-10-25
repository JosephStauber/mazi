import { z } from "zod";

/** Statement of reasons for a suspension or profile reset — shown to the user. */
export const suspendReasonSchema = z
  .string()
  .trim()
  .min(1, "Give a reason — the user will see it")
  .max(500, "Reason must be at most 500 characters");

export const SUSPEND_DURATIONS = {
  "1d": { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  "7d": { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  permanent: { label: "Until restored", ms: null },
} as const;
export type SuspendDuration = keyof typeof SUSPEND_DURATIONS;

export const adminNoteSchema = z
  .string()
  .trim()
  .min(1, "Note can't be empty")
  .max(2000, "Note must be at most 2000 characters");

export const appealSchema = z
  .string()
  .trim()
  .min(10, "Tell us a little more (at least 10 characters)")
  .max(1000, "Appeal must be at most 1000 characters");

/** Optional reply to an appeal — emailed to the user. */
export const appealResponseSchema = z
  .string()
  .trim()
  .max(1000, "Response must be at most 1000 characters");

export const blockedHandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{2,30}$/, "2–30 letters, numbers or underscores");

export const announcementSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject").max(120, "Subject is too long"),
  body: z.string().trim().min(1, "Write the message").max(5000, "Message is too long"),
});
