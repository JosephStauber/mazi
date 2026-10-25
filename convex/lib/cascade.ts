import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Cascading deletes (Postgres did these with ON DELETE CASCADE). Each helper
 * also keeps the denormalized counters (likeCount, commentCount, memberCount,
 * postCount, follower/followingCount) correct.
 */

async function deleteNotifications(
  ctx: MutationCtx,
  rows: Doc<"notifications">[]
) {
  await Promise.all(rows.map((n) => ctx.db.delete(n._id)));
}

async function adjust(
  ctx: MutationCtx,
  id: Id<"profiles"> | Id<"posts"> | Id<"communities">,
  field: "postCount" | "likeCount" | "commentCount" | "memberCount" | "followerCount" | "followingCount",
  delta: number
) {
  const doc = (await ctx.db.get(id)) as Record<string, unknown> | null;
  if (!doc) return;
  const current = typeof doc[field] === "number" ? (doc[field] as number) : 0;
  await ctx.db.patch(id, { [field]: Math.max(0, current + delta) });
}

export const bump = adjust;

/** Delete a comment, its replies, and their notifications. */
export async function deleteCommentCascade(ctx: MutationCtx, comment: Doc<"comments">) {
  const replies = await ctx.db
    .query("comments")
    .withIndex("by_parent", (q) => q.eq("parentId", comment._id))
    .collect();
  for (const c of [...replies, comment]) {
    await deleteNotifications(
      ctx,
      await ctx.db
        .query("notifications")
        .withIndex("by_comment", (q) => q.eq("commentId", c._id))
        .collect()
    );
    await ctx.db.delete(c._id);
  }
  await adjust(ctx, comment.postId, "commentCount", -(replies.length + 1));
}

/** Delete a post with its comments, likes, notifications, and image. */
export async function deletePostCascade(ctx: MutationCtx, post: Doc<"posts">) {
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_post_parent", (q) => q.eq("postId", post._id))
    .collect();
  for (const c of comments) {
    await deleteNotifications(
      ctx,
      await ctx.db
        .query("notifications")
        .withIndex("by_comment", (q) => q.eq("commentId", c._id))
        .collect()
    );
    await ctx.db.delete(c._id);
  }
  const likes = await ctx.db
    .query("likes")
    .withIndex("by_post_user", (q) => q.eq("postId", post._id))
    .collect();
  await Promise.all(likes.map((l) => ctx.db.delete(l._id)));
  await deleteNotifications(
    ctx,
    await ctx.db
      .query("notifications")
      .withIndex("by_post", (q) => q.eq("postId", post._id))
      .collect()
  );
  if (post.imageId) await ctx.storage.delete(post.imageId);
  await adjust(ctx, post.authorId, "postCount", -1);
  await ctx.db.delete(post._id);
}

/** Delete a community with its members, invites, posts, and notifications. */
export async function deleteCommunityCascade(
  ctx: MutationCtx,
  community: Doc<"communities">
) {
  const [members, invites, posts, notifications] = await Promise.all([
    ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect(),
    ctx.db
      .query("communityInvites")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect(),
    ctx.db
      .query("posts")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect(),
    ctx.db
      .query("notifications")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect(),
  ]);
  for (const post of posts) await deletePostCascade(ctx, post);
  await Promise.all([
    ...members.map((m) => ctx.db.delete(m._id)),
    ...invites.map((i) => ctx.db.delete(i._id)),
  ]);
  await deleteNotifications(ctx, notifications);
  await ctx.db.delete(community._id);
}

/** Remove one membership row and keep memberCount in step. */
export async function removeMembership(ctx: MutationCtx, m: Doc<"communityMembers">) {
  await ctx.db.delete(m._id);
  await adjust(ctx, m.communityId, "memberCount", -1);
}
