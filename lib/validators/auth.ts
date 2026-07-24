import { z } from "zod";

// Login stays permissive (legacy accounts may have shorter passwords).
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * Shared new-account password policy — mirrors the Supabase project's rule
 * (8+ chars, one lowercase, one uppercase, one digit) so users get clear
 * guidance instead of a cryptic error on submit. Reused by the reserve flow.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  );

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: usernameSchema,
  password: passwordSchema,
  agreed: z.literal("on", {
    message:
      "You must confirm your age and accept the Terms and Privacy Policy",
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
