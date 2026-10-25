import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";

/**
 * Authorized post-image delivery. The browser never gets a raw storage URL:
 * every request re-checks (as the signed-in user) that the post is visible —
 * so images in invite-only communities stay private — then streams the bytes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  let url: string | null = null;
  try {
    url = await fetchAuthQuery(api.files.postImageUrl, {
      postId: postId as Id<"posts">,
    });
  } catch {
    url = null;
  }
  if (!url) return new NextResponse("Not found", { status: 404 });

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      // Per-user authorization: never let a shared cache store it.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
