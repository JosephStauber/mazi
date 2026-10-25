import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isReservationMode } from "@/lib/reserve/config";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/reserve", "/forgot-password", "/reset-password"];
const PUBLIC_PREFIXES = ["/legal", "/api/auth"];

/**
 * Optimistic routing only: checks that a session cookie *exists*, without
 * validating it (that would cost a round trip per request). Real enforcement
 * is in the Convex functions (convex/lib/access.ts), and the protected
 * layouts verify the session server-side before rendering.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);

  // Pre-launch: open signup is closed — the public front door is the funnel.
  // Login stays open so existing testers can still get in.
  if (isReservationMode() && pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/reserve";
    return NextResponse.redirect(url);
  }

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // No "signed in → skip /login" redirect here: a stale cookie would bounce
  // between /login and the protected layout. The auth pages handle that case.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
