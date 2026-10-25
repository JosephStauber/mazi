import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

/**
 * Server-side auth helpers (route handlers, server components). `getToken`
 * reads the session cookie and returns a Convex JWT; `fetchAuthQuery` runs a
 * Convex query as the signed-in user.
 */
export const {
  handler,
  getToken,
  isAuthenticated,
  preloadAuthQuery,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
