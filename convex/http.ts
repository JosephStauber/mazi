import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Better Auth endpoints (/api/auth/*). The Next.js app proxies to these from
// its own /api/auth route so cookies stay first-party.
authComponent.registerRoutes(http, createAuth);

export default http;
