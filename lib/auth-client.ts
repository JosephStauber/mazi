"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { auth } from "@/convex/betterAuth/auth";

/**
 * Browser-side Better Auth client. Requests go to this app's own /api/auth
 * route (same origin, first-party cookies), which proxies to Convex.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), passkeyClient(), convexClient()],
});

/** Better Auth errors carry a message; fall back to something human. */
export function authErrorMessage(
  error: { message?: string | null; code?: string | null } | null | undefined,
  fallback = "Something went wrong — please try again."
): string {
  return error?.message || fallback;
}
