import { z } from "zod";

export const commentContentSchema = z
  .string()
  .trim()
  .min(1, "Comment cannot be empty")
  .max(1000, "Comment must be at most 1000 characters");
