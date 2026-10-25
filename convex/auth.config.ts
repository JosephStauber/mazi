import type { AuthConfig } from "convex/server";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

// Without this file Convex never validates the Better Auth JWT and every
// request is silently anonymous.
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
