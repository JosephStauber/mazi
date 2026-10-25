import { handler } from "@/lib/auth-server";

// Proxies Better Auth requests to the Convex HTTP actions (convex/http.ts).
export const { GET, POST } = handler;
