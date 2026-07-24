import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE callback. Supabase email links (confirmation, recovery) redirect here
 * with a `code`; we exchange it for a session (cookies) and forward to a
 * validated local path. Without this, `@supabase/ssr` never establishes the
 * session and the user bounces to /login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Only same-origin local paths — never an open redirect.
  const raw = searchParams.get("next") || "/welcome";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/welcome";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
