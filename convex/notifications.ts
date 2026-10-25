import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getFullAccessViewer, requireFullAccess } from "./lib/access";
import { iso, refLoader } from "./lib/dto";
import { communityRefV, profileRefV } from "./lib/returns";

const notificationV = v.object({
  id: v.string(),
  type: v.union(
    v.literal("like"),
    v.literal("comment"),
    v.literal("follow"),
    v.literal("community_invite"),
    v.literal("mention")
  ),
  read: v.boolean(),
  created_at: v.string(),
  post_id: v.union(v.string(), v.null()),
  comment_id: v.union(v.string(), v.null()),
  community_id: v.union(v.string(), v.null()),
  actor: v.union(profileRefV, v.null()),
  community: v.union(communityRefV, v.null()),
  /** Set while a targeted invite can still be accepted/declined. */
  pending_invite_id: v.union(v.id("communityInvites"), v.null()),
});

/** The viewer's latest notifications (recipient-only). */
export const list = query({
  args: {},
  returns: v.array(notificationV),
  handler: async (ctx) => {
    const viewer = await requireFullAccess(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .order("desc")
      .take(50);
    const load = refLoader(ctx);
    return await Promise.all(
      rows.map(async (n) => {
        const [actor, community, invite] = await Promise.all([
          n.actorId ? load(n.actorId) : null,
          n.communityId ? ctx.db.get(n.communityId) : null,
          n.inviteId ? ctx.db.get(n.inviteId) : null,
        ]);
        return {
          id: n._id,
          type: n.type,
          read: n.read,
          created_at: iso(n._creationTime),
          post_id: n.postId ?? null,
          comment_id: n.commentId ?? null,
          community_id: n.communityId ?? null,
          actor,
          community: community
            ? { id: community._id, name: community.name, slug: community.slug }
            : null,
          pending_invite_id:
            invite && invite.status === "pending" && invite.inviteeId === viewer._id
              ? invite._id
              : null,
        };
      })
    );
  },
});

export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const viewer = await getFullAccessViewer(ctx);
    if (!viewer) return 0;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", viewer._id).eq("read", false))
      .take(100);
    return unread.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, { notificationId }) => {
    const viewer = await requireFullAccess(ctx);
    const n = await ctx.db.get(notificationId);
    if (n && n.userId === viewer._id && !n.read) await ctx.db.patch(n._id, { read: true });
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const viewer = await requireFullAccess(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", viewer._id).eq("read", false))
      .take(500);
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
    return null;
  },
});
