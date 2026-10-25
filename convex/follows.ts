import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { deny, requireFullAccess } from "./lib/access";
import { bump } from "./lib/cascade";
import { notify } from "./lib/notify";

export const toggle = mutation({
  args: { targetUserId: v.id("profiles") },
  returns: v.object({ following: v.boolean() }),
  handler: async (ctx, { targetUserId }) => {
    const viewer = await requireFullAccess(ctx);
    if (viewer._id === targetUserId) deny("Cannot follow yourself");
    const target = await ctx.db.get(targetUserId);
    if (!target || target.accessLevel !== "full") deny("User not found");

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", viewer._id).eq("followingId", targetUserId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await bump(ctx, viewer._id, "followingCount", -1);
      await bump(ctx, targetUserId, "followerCount", -1);
      return { following: false };
    }
    await ctx.db.insert("follows", { followerId: viewer._id, followingId: targetUserId });
    await bump(ctx, viewer._id, "followingCount", 1);
    await bump(ctx, targetUserId, "followerCount", 1);
    await notify(ctx, { userId: targetUserId, actorId: viewer._id, type: "follow" });
    return { following: true };
  },
});
