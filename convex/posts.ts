import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import {
  canModeratePost,
  canViewPost,
  deny,
  getMembership,
  requireFullAccess,
  requireVisiblePost,
} from "./lib/access";
import { bump, deletePostCascade } from "./lib/cascade";
import { refLoader, toPostDTO } from "./lib/dto";
import { notify, notifyMentions } from "./lib/notify";
import { paginated, postV } from "./lib/returns";
import { parseOrDeny } from "./lib/validate";
import { claimImage } from "./files";
import { POST_IMAGE_MAX_BYTES, postContentSchema } from "../lib/validators/post";

export const create = mutation({
  args: {
    content: v.string(),
    communityId: v.optional(v.id("communities")),
    imageId: v.optional(v.id("_storage")),
  },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    const viewer = await requireFullAccess(ctx);
    const content = parseOrDeny(postContentSchema, args.content);
    if (args.communityId) {
      // Community posts require membership (was RLS 00006/B).
      if (!(await getMembership(ctx, args.communityId, viewer._id))) {
        deny("Join this community to post in it");
      }
    }
    if (args.imageId) await claimImage(ctx, args.imageId, POST_IMAGE_MAX_BYTES);

    const postId = await ctx.db.insert("posts", {
      authorId: viewer._id,
      content,
      communityId: args.communityId,
      imageId: args.imageId,
      likeCount: 0,
      commentCount: 0,
    });
    await bump(ctx, viewer._id, "postCount", 1);
    const post = (await ctx.db.get(postId))!;
    await notifyMentions(ctx, { content, actor: viewer, post });
    return postId;
  },
});

export const edit = mutation({
  args: { postId: v.id("posts"), content: v.string() },
  returns: v.null(),
  handler: async (ctx, { postId, content }) => {
    const viewer = await requireFullAccess(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.authorId !== viewer._id) deny("Post not found");
    // Membership is re-checked so a removed member can't keep editing (00006/F).
    if (post.communityId && !(await getMembership(ctx, post.communityId, viewer._id))) {
      deny("You're no longer a member of this community");
    }
    await ctx.db.patch(postId, { content: parseOrDeny(postContentSchema, content) });
    return null;
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, { postId }) => {
    const viewer = await requireFullAccess(ctx);
    const post = await ctx.db.get(postId);
    if (!post) deny("Post not found");
    const allowed =
      post.authorId === viewer._id || (await canModeratePost(ctx, viewer, post));
    if (!allowed) deny("You can't delete this post");
    await deletePostCascade(ctx, post);
    return null;
  },
});

export const toggleLike = mutation({
  args: { postId: v.id("posts") },
  returns: v.object({ liked: v.boolean() }),
  handler: async (ctx, { postId }) => {
    const viewer = await requireFullAccess(ctx);
    const post = await requireVisiblePost(ctx, viewer, postId);
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_post_user", (q) => q.eq("postId", postId).eq("userId", viewer._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await bump(ctx, postId, "likeCount", -1);
      return { liked: false };
    }
    await ctx.db.insert("likes", { postId, userId: viewer._id });
    await bump(ctx, postId, "likeCount", 1);
    await notify(ctx, { userId: post.authorId, actorId: viewer._id, type: "like", postId });
    return { liked: true };
  },
});

/** A single post for its detail page, plus whether the viewer can moderate it. */
export const get = query({
  args: { postId: v.string() },
  returns: v.union(v.null(), v.object({ post: postV, can_moderate: v.boolean() })),
  handler: async (ctx, args) => {
    const viewer = await requireFullAccess(ctx);
    const postId = ctx.db.normalizeId("posts", args.postId);
    if (!postId) return null;
    const post = await ctx.db.get(postId);
    if (!post || !(await canViewPost(ctx, viewer, post))) return null;
    return {
      post: await toPostDTO(ctx, viewer, post),
      can_moderate: await canModeratePost(ctx, viewer, post),
    };
  },
});

/** A user's posts, newest first, hiding community posts the viewer can't see. */
export const byAuthor = query({
  args: { userId: v.id("profiles"), paginationOpts: paginationOptsValidator },
  returns: paginated(postV),
  handler: async (ctx, { userId, paginationOpts }) => {
    const viewer = await requireFullAccess(ctx);
    const result = await stream(ctx.db, schema)
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .filterWith((post) => canViewPost(ctx, viewer, post))
      .paginate(paginationOpts);
    const load = refLoader(ctx);
    return {
      ...result,
      page: await Promise.all(result.page.map((p) => toPostDTO(ctx, viewer, p, load))),
    };
  },
});
