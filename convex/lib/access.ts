import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Access control — the replacement for Supabase RLS.
 *
 * Convex has no row-level security: the client can call any *public* function
 * with any arguments, so every public query/mutation must decide for itself
 * who may see or change what. These helpers are the single place those rules
 * live; functions call them before touching data. See docs/SECURITY.md.
 */

export type Viewer = Doc<"profiles">;

/** Thrown for anything the caller isn't allowed to do. Message is user-safe. */
export function deny(message: string): never {
  throw new ConvexError(message);
}

/** The signed-in user's profile, or null (anonymous / no profile yet). */
export async function getViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("profiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique();
}

export async function requireViewer(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) deny("Not authenticated");
  return viewer;
}

/**
 * Signed in with a `full` account. Every "using the app" read and write goes
 * through this: `reserved` (pre-launch) accounts can only see and edit their
 * own profile + reservation.
 */
export async function requireFullAccess(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (viewer.accessLevel !== "full") {
    deny("Mazi isn't open for your account yet");
  }
  return viewer;
}

/** Like `requireFullAccess`, but null instead of throwing (for list queries). */
export async function getFullAccessViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const viewer = await getViewer(ctx);
  return viewer?.accessLevel === "full" ? viewer : null;
}

export async function getMembership(
  ctx: QueryCtx,
  communityId: Id<"communities">,
  userId: Id<"profiles">
): Promise<Doc<"communityMembers"> | null> {
  return await ctx.db
    .query("communityMembers")
    .withIndex("by_community_user", (q) =>
      q.eq("communityId", communityId).eq("userId", userId)
    )
    .unique();
}

export function isModeratorRole(role: Doc<"communityMembers">["role"] | undefined) {
  return role === "creator" || role === "moderator";
}

/**
 * Post visibility (was RLS F5): personal posts are visible to every full user;
 * community posts to the author, any member, or anyone if the community is
 * public.
 */
export async function canViewPost(
  ctx: QueryCtx,
  viewer: Viewer,
  post: Doc<"posts">
): Promise<boolean> {
  if (!post.communityId || post.authorId === viewer._id) return true;
  const community = await ctx.db.get(post.communityId);
  if (!community) return false;
  if (community.privacyType === "public") return true;
  return (await getMembership(ctx, community._id, viewer._id)) !== null;
}

/** Load a post the viewer may see, or throw a not-found (no existence leak). */
export async function requireVisiblePost(
  ctx: QueryCtx,
  viewer: Viewer,
  postId: Id<"posts">
): Promise<Doc<"posts">> {
  const post = await ctx.db.get(postId);
  if (!post || !(await canViewPost(ctx, viewer, post))) deny("Post not found");
  return post;
}

/** Whether the viewer may moderate (delete) content in this post's community. */
export async function canModeratePost(
  ctx: QueryCtx,
  viewer: Viewer,
  post: Doc<"posts">
): Promise<boolean> {
  if (!post.communityId) return false;
  const m = await getMembership(ctx, post.communityId, viewer._id);
  return isModeratorRole(m?.role);
}
