import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mergedStream, stream } from "convex-helpers/server/stream";
import { query } from "./_generated/server";
import schema from "./schema";
import { requireFullAccess } from "./lib/access";
import { refLoader, toPostDTO } from "./lib/dto";
import { paginated, postV } from "./lib/returns";

/**
 * Feeds are strictly reverse-chronological (product rule — no ranking).
 *
 * Convex has no `WHERE author_id IN (...)`, so a feed is one index stream per
 * followed author / joined community, merged by `_creationTime`. Each stream is
 * an equality lookup on its index prefix, so it is already time-ordered and
 * the merge is exact; pagination cursors stay stable as new posts arrive.
 */

const EMPTY = { page: [], isDone: true, continueCursor: "" };

/** Personal posts from people the viewer follows. */
export const following = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginated(postV),
  handler: async (ctx, { paginationOpts }) => {
    const viewer = await requireFullAccess(ctx);
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", viewer._id))
      .take(2000);
    if (follows.length === 0) return EMPTY;

    const streams = follows.map((f) =>
      stream(ctx.db, schema)
        .query("posts")
        .withIndex("by_author_community", (q) =>
          q.eq("authorId", f.followingId).eq("communityId", undefined)
        )
        .order("desc")
    );
    const result = await mergedStream(streams, ["_creationTime"]).paginate(paginationOpts);
    const load = refLoader(ctx);
    return {
      ...result,
      page: await Promise.all(result.page.map((p) => toPostDTO(ctx, viewer, p, load))),
    };
  },
});

/**
 * Posts in the viewer's communities — all of them, or one (`communityId`),
 * which must be one the viewer belongs to.
 */
export const communities = query({
  args: {
    communityId: v.optional(v.id("communities")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginated(postV),
  handler: async (ctx, { communityId, paginationOpts }) => {
    const viewer = await requireFullAccess(ctx);
    const memberships = await ctx.db
      .query("communityMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect();
    const ids = memberships
      .map((m) => m.communityId)
      .filter((id) => !communityId || id === communityId);
    if (ids.length === 0) return EMPTY;

    const streams = ids.map((id) =>
      stream(ctx.db, schema)
        .query("posts")
        .withIndex("by_community", (q) => q.eq("communityId", id))
        .order("desc")
    );
    const result = await mergedStream(streams, ["_creationTime"]).paginate(paginationOpts);
    const load = refLoader(ctx);
    return {
      ...result,
      page: await Promise.all(result.page.map((p) => toPostDTO(ctx, viewer, p, load))),
    };
  },
});

/** One community's posts (its page). Readable by anyone who can see them. */
export const community = query({
  args: { communityId: v.id("communities"), paginationOpts: paginationOptsValidator },
  returns: paginated(postV),
  handler: async (ctx, { communityId, paginationOpts }) => {
    const viewer = await requireFullAccess(ctx);
    const c = await ctx.db.get(communityId);
    if (!c) return EMPTY;
    if (c.privacyType !== "public") {
      const member = await ctx.db
        .query("communityMembers")
        .withIndex("by_community_user", (q) =>
          q.eq("communityId", communityId).eq("userId", viewer._id)
        )
        .unique();
      if (!member) return EMPTY;
    }
    const result = await ctx.db
      .query("posts")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .order("desc")
      .paginate(paginationOpts);
    const load = refLoader(ctx);
    return {
      ...result,
      page: await Promise.all(result.page.map((p) => toPostDTO(ctx, viewer, p, load))),
    };
  },
});
