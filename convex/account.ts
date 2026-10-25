import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireViewer } from "./lib/access";
import { iso } from "./lib/dto";
import { authComponent } from "./auth";
import { legal } from "../lib/legal/config";

/**
 * Right to access / portability (GDPR Art. 15 & 20): everything we hold about
 * the signed-in user, as JSON. Only the caller's own rows are read. (Deletion
 * is Better Auth's `deleteUser`, whose trigger erases all app data.)
 */
export const exportMyData = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const me = await requireViewer(ctx);
    const user = await authComponent.getAuthUser(ctx);

    const strip = <T extends { _id: string; _creationTime: number }>(rows: T[]) =>
      rows.map(({ _id, _creationTime, ...rest }) => ({ id: _id, created_at: iso(_creationTime), ...rest }));

    const [posts, comments, likes, following, followers, memberships, notifications, invitesSent, invitesReceived, communitiesCreated, reservation] =
      await Promise.all([
        ctx.db.query("posts").withIndex("by_author", (q) => q.eq("authorId", me._id)).collect(),
        ctx.db.query("comments").withIndex("by_author", (q) => q.eq("authorId", me._id)).collect(),
        ctx.db.query("likes").withIndex("by_user", (q) => q.eq("userId", me._id)).collect(),
        ctx.db.query("follows").withIndex("by_follower", (q) => q.eq("followerId", me._id)).collect(),
        ctx.db.query("follows").withIndex("by_following", (q) => q.eq("followingId", me._id)).collect(),
        ctx.db.query("communityMembers").withIndex("by_user", (q) => q.eq("userId", me._id)).collect(),
        ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", me._id)).collect(),
        ctx.db.query("communityInvites").withIndex("by_inviter", (q) => q.eq("inviterId", me._id)).collect(),
        ctx.db.query("communityInvites").withIndex("by_invitee", (q) => q.eq("inviteeId", me._id)).collect(),
        ctx.db.query("communities").withIndex("by_creator", (q) => q.eq("creatorId", me._id)).collect(),
        ctx.db.query("reservations").withIndex("by_profile", (q) => q.eq("profileId", me._id)).unique(),
      ]);

    const { authUserId: _authUserId, usernameLower: _lower, ...profile } = me;
    void _authUserId;
    void _lower;

    return {
      export: {
        service: legal.appName,
        generated_at: new Date().toISOString(),
        format: "GDPR data portability export (JSON)",
      },
      account: {
        id: user._id,
        email: user.email,
        email_verified: user.emailVerified,
        created_at: new Date(user.createdAt).toISOString(),
      },
      profile: strip([profile])[0],
      reservation: reservation ? strip([reservation])[0] : null,
      posts: strip(posts),
      comments: strip(comments),
      likes: strip(likes),
      following: strip(following),
      followers: strip(followers),
      community_memberships: strip(memberships),
      notifications: strip(notifications),
      invites_sent: strip(invitesSent),
      invites_received: strip(invitesReceived),
      communities_created: strip(communitiesCreated),
    };
  },
});
