import { z } from "zod";
import { passwordSchema, usernameSchema } from "@/lib/validators/auth";
import { REASON_IDS, TIME_SLIDER } from "@/lib/reserve/config";

/**
 * Pre-launch "reserve your username" submission. Reuses the shared account
 * rules (username/password) and constrains the survey to the funnel's actual
 * domain: canonical reason IDs (unique) and the slider's minute range. Hard
 * limits are also enforced/sanitized in the 00010/00012 signup trigger.
 */
export const reserveSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: usernameSchema,
  password: passwordSchema,
  agreed: z.literal(true, {
    message:
      "You must confirm your age and accept the Terms and Privacy Policy",
  }),
  reasons: z
    .array(z.enum(REASON_IDS))
    .max(REASON_IDS.length)
    .default([])
    .transform((r) => Array.from(new Set(r))),
  dailyMinutes: z
    .number()
    .int()
    .min(TIME_SLIDER.min)
    .max(TIME_SLIDER.max)
    .nullable()
    .default(null),
  referredBy: z
    .string()
    .max(64)
    .optional()
    .transform((v) => v?.trim() || undefined),
});

export type ReserveInput = z.infer<typeof reserveSchema>;
