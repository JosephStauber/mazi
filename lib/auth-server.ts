import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

/**
 * The Convex HTTP-actions origin (where the Better Auth routes live). Set
 * NEXT_PUBLIC_CONVEX_SITE_URL to override; otherwise it's derived from the
 * deployment URL — `https://x.convex.cloud` → `https://x.convex.site`, and a
 * local backend's port + 1 (`:3210` → `:3211`) — so hosts that only inject
 * NEXT_PUBLIC_CONVEX_URL (e.g. `npx convex deploy --cmd`) need nothing else.
 */
function convexSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  }
  if (!convexUrl) return "";
  const url = new URL(convexUrl);
  if (url.hostname.endsWith(".convex.cloud")) {
    url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  } else if (url.port) {
    url.port = String(Number(url.port) + 1);
  }
  return url.origin;
}

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
  convexUrl,
  convexSiteUrl: convexSiteUrl(),
});
