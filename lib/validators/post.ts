import { z } from "zod";

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, "Post cannot be empty")
    .max(2000, "Post must be at most 2000 characters"),
  community_id: z.string().uuid().nullable().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
