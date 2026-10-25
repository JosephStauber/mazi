import { ConvexError } from "convex/values";

/**
 * User-facing message for a failed Convex call. Access/validation failures are
 * thrown as `ConvexError(message)` (convex/lib/access.ts); anything else is
 * unexpected and gets a generic message rather than leaking server details.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong — please try again."): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return fallback;
}
