import { z } from "zod";

export const createCommunitySchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),
  description: z
    .string()
    .max(300, "Description must be at most 300 characters")
    .optional(),
  privacy_type: z.enum(["public", "invite_only"]),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

export const updateCommunitySchema = createCommunitySchema;

export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
