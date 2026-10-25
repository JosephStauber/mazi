import { z } from "zod";

/** Statement of reasons for a suspension — shown to the suspended user. */
export const suspendReasonSchema = z
  .string()
  .trim()
  .min(1, "Give a reason — the user will see it")
  .max(500, "Reason must be at most 500 characters");
