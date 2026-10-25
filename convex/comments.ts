import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  canModeratePost,
  canViewPost,
  deny,
  requireFullAccess,
  requireVisiblePost,
} from "./lib/access";
import { bump, deleteCommentCascade } from "./lib/cascade";
import { refLoader, toCommentDTO } from "./lib/dto";
import { notify, notifyMentions } from "./lib/notify";
import { commentV, paginated } from "./lib/returns";
import { parseOrDeny } from "./lib/validate";
import { commentContentSchema } from "../lib/validators/comment";

/**
 * A page of a post's comments, paginated by root comment (oldest first). Each
 * page also carries every reply to its roots, so threads stay whole across
 * pages; the client re-threads the flat list.
 */
export const list = query({
  args: { postId: v.id("posts"), paginationOpts: paginationOptsValidator },
  returns: paginated(commentV),
  handler: async (ctx, { postId, paginationOpts }) => {
    const viewer = await requireFullAccess(ctx);
    await requireVisiblePost(ctx, viewer, postId);
    const roots = await ctx.db
      .query("comments")
      .withIndex("by_post_parent", (q) => q.eq("postId", postId).eq("parentId", undefined))
      .order("asc")
      .paginate(paginationOpts);
    const replies = (
      await Promise.all(
        roots.page.map((r) =>
          ctx.db
            .query("comments")
            .withIndex("by_parent", (q) => q.eq("parentId", r._id))
            .order("asc")
            .collect()
        )
      )
    ).flat();
    const load = refLoader(ctx);
    return {
      ...roots,
      page: await Promise.all([...roots.page, ...replies].map((c) => toCommentDTO(ctx, c, load))),
    };
  },
});

export const create = mutation({
  args: {
    postId: v.id("posts"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const viewer = await requireFullAccess(ctx);
    // Commenting requires being able to see the post (was RLS F10).
    const post = await requireVisiblePost(ctx, viewer, args.postId);
    const content = parseOrDeny(commentContentSchema, args.content);

    // Replies attach to the thread's root, which must be on the same post
    // (was the comments_parent_integrity trigger, 00006/G).
    let parentId: Id<"comments"> | undefined;
    let parentAuthor: Id<"profiles"> | undefined;
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.postId !== post._id) deny("That comment no longer exists");
      parentId = parent.parentId ?? parent._id;
      parentAuthor = parent.authorId;
    }

    const commentId = await ctx.db.insert("comments", {
      postId: post._id,
      authorId: viewer._id,
      content,
      parentId,
    });
    await bump(ctx, post._id, "commentCount", 1);

    const notified: Id<"profiles">[] = [];
    for (const recipient of [post.authorId, parentAuthor]) {
      if (!recipient || recipient === viewer._id || notified.includes(recipient)) continue;
      notified.push(recipient);
      await notify(ctx, {
        userId: recipient,
        actorId: viewer._id,
        type: "comment",
        postId: post._id,
        commentId,
      });
    }
    await notifyMentions(ctx, { content, actor: viewer, post, commentId, exclude: notified });
    return commentId;
  },
});

export const edit = mutation({
  args: { commentId: v.id("comments"), content: v.string() },
  returns: v.null(),
  handler: async (ctx, { commentId, content }) => {
    const viewer = await requireFullAccess(ctx);
    const comment = await ctx.db.get(commentId);
    if (!comment || comment.authorId !== viewer._id) deny("Comment not found");
    // The post must still be visible to the author (00006/F).
    const post = await ctx.db.get(comment.postId);
    if (!post || !(await canViewPost(ctx, viewer, post))) deny("Comment not found");
    await ctx.db.patch(commentId, { content: parseOrDeny(commentContentSchema, content) });
    return null;
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, { commentId }) => {
    const viewer = await requireFullAccess(ctx);
    const comment = await ctx.db.get(commentId);
    if (!comment) deny("Comment not found");
    const post = await ctx.db.get(comment.postId);
    const allowed =
      comment.authorId === viewer._id ||
      (post !== null && (await canModeratePost(ctx, viewer, post)));
    if (!allowed) deny("You can't delete this comment");
    await deleteCommentCascade(ctx, comment);
    return null;
  },
});
