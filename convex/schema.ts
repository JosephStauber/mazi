import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Mazi's app data. Better Auth's tables (user/session/account/passkey/...) live
 * in the `betterAuth` component; a profile links to its auth user through
 * `authUserId` (the Better Auth user id, which is also the JWT `subject`).
 *
 * There is no row-level security in Convex: every table is reachable only
 * through the functions in this directory, and each function enforces its own
 * access rules via the helpers in `lib/access.ts`. See docs/SECURITY.md.
 *
 * Timestamps are Convex's built-in `_creationTime`. Every index implicitly ends
 * in `_creationTime`, so "by_x" indexes double as chronological orderings.
 */

export const accessLevel = v.union(v.literal("reserved"), v.literal("full"));
export const privacyType = v.union(
  v.literal("public"),
  v.literal("invite_only")
);
export const communityRole = v.union(
  v.literal("member"),
  v.literal("moderator"),
  v.literal("creator")
);
export const inviteStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired")
);
export const notificationType = v.union(
  v.literal("like"),
  v.literal("comment"),
  v.literal("follow"),
  v.literal("community_invite"),
  v.literal("mention")
);
export const signupMode = v.union(v.literal("reservation"), v.literal("open"));
export const adminAction = v.union(
  v.literal("suspend"),
  v.literal("unsuspend"),
  v.literal("grant_admin"),
  v.literal("set_signup_mode"),
  v.literal("reveal_email"),
  v.literal("reset_profile"),
  v.literal("appeal_accepted"),
  v.literal("appeal_rejected"),
  v.literal("community_takedown"),
  v.literal("community_transfer"),
  v.literal("block_handle"),
  v.literal("unblock_handle"),
  v.literal("announcement_sent")
);
/** `owner` can do everything; `moderator` can't see emails or run launch/handle/community-removal tools. */
export const adminRole = v.union(v.literal("owner"), v.literal("moderator"));
export const appealStatus = v.union(
  v.literal("open"),
  v.literal("accepted"),
  v.literal("rejected")
);
export const handleMatch = v.union(v.literal("exact"), v.literal("contains"));

export default defineSchema({
  profiles: defineTable({
    authUserId: v.string(),
    username: v.string(),
    /** Lowercased handle: case-insensitive uniqueness + prefix lookups. */
    usernameLower: v.string(),
    bio: v.optional(v.string()),
    avatarId: v.optional(v.id("_storage")),
    /** Pre-launch tier. `reserved` can edit its profile but can't use the app. */
    accessLevel,
    followerCount: v.number(),
    followingCount: v.number(),
    postCount: v.number(),
    /** Set while an admin has suspended the account (see `isSuspended`). */
    suspendedAt: v.optional(v.number()),
    /** Statement of reasons, shown to the suspended user. */
    suspendedReason: v.optional(v.string()),
    /** Timed suspension end; unset = until an admin restores it. Lifted by cron. */
    suspendedUntil: v.optional(v.number()),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_usernameLower", ["usernameLower"])
    .index("by_avatar", ["avatarId"])
    .index("by_accessLevel", ["accessLevel"])
    .index("by_suspendedAt", ["suspendedAt"])
    .index("by_suspendedUntil", ["suspendedUntil"])
    .searchIndex("search_username", { searchField: "username" }),

  communities: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    creatorId: v.id("profiles"),
    privacyType,
    memberCount: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_creator", ["creatorId"])
    .searchIndex("search_name", { searchField: "name" }),

  communityMembers: defineTable({
    communityId: v.id("communities"),
    userId: v.id("profiles"),
    role: communityRole,
  })
    .index("by_community", ["communityId"])
    .index("by_user", ["userId"])
    .index("by_community_user", ["communityId", "userId"]),

  communityInvites: defineTable({
    communityId: v.id("communities"),
    inviterId: v.id("profiles"),
    /** Targeted invite. Exactly one of inviteeId / token is set. */
    inviteeId: v.optional(v.id("profiles")),
    /** Shareable, multi-use link token. */
    token: v.optional(v.string()),
    status: inviteStatus,
    expiresAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_invitee", ["inviteeId"])
    .index("by_inviter", ["inviterId"])
    .index("by_community", ["communityId"])
    .index("by_community_invitee", ["communityId", "inviteeId"]),

  posts: defineTable({
    authorId: v.id("profiles"),
    content: v.string(),
    imageId: v.optional(v.id("_storage")),
    /** Unset for a personal post (shown to followers). */
    communityId: v.optional(v.id("communities")),
    likeCount: v.number(),
    commentCount: v.number(),
  })
    .index("by_author", ["authorId"])
    // Personal posts by author: the following feed reads `communityId = undefined`.
    .index("by_author_community", ["authorId", "communityId"])
    .index("by_community", ["communityId"])
    .index("by_image", ["imageId"]),

  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.id("profiles"),
    content: v.string(),
    /** Root comment of the thread when this is a reply (replies are one level). */
    parentId: v.optional(v.id("comments")),
  })
    .index("by_post_parent", ["postId", "parentId"])
    .index("by_parent", ["parentId"])
    .index("by_author", ["authorId"]),

  likes: defineTable({
    postId: v.id("posts"),
    userId: v.id("profiles"),
  })
    .index("by_post_user", ["postId", "userId"])
    .index("by_user", ["userId"]),

  follows: defineTable({
    followerId: v.id("profiles"),
    followingId: v.id("profiles"),
  })
    .index("by_follower_following", ["followerId", "followingId"])
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"]),

  notifications: defineTable({
    /** Recipient. */
    userId: v.id("profiles"),
    actorId: v.optional(v.id("profiles")),
    type: notificationType,
    postId: v.optional(v.id("posts")),
    commentId: v.optional(v.id("comments")),
    communityId: v.optional(v.id("communities")),
    inviteId: v.optional(v.id("communityInvites")),
    read: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"])
    .index("by_actor", ["actorId"])
    .index("by_post", ["postId"])
    .index("by_comment", ["commentId"])
    .index("by_community", ["communityId"]),

  /** Pre-launch reservation: survey answers + referral graph. No email here. */
  reservations: defineTable({
    profileId: v.id("profiles"),
    reasons: v.array(v.string()),
    dailySocialMinutes: v.optional(v.number()),
    referralCode: v.string(),
    referredBy: v.optional(v.string()),
  })
    .index("by_profile", ["profileId"])
    .index("by_referralCode", ["referralCode"])
    .index("by_referredBy", ["referredBy"]),

  /** Admin allowlist (reservation dashboard). Seeded with `admin:grant`. */
  adminUsers: defineTable({
    profileId: v.id("profiles"),
    /** Unset ⇒ `owner` (rows granted before roles existed). */
    role: v.optional(adminRole),
  }).index("by_profile", ["profileId"]),

  /** Private admin notes about an account. Deleted with the account. */
  adminNotes: defineTable({
    targetId: v.id("profiles"),
    authorId: v.optional(v.id("profiles")),
    body: v.string(),
  })
    .index("by_target", ["targetId"])
    .index("by_author", ["authorId"]),

  /** A suspended user's appeal. One open appeal per suspension. */
  appeals: defineTable({
    profileId: v.id("profiles"),
    body: v.string(),
    status: appealStatus,
    response: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_profile", ["profileId"])
    .index("by_status", ["status"]),

  /** Handles nobody can sign up with or rename to (on top of the built-in list). */
  blockedHandles: defineTable({
    handleLower: v.string(),
    match: handleMatch,
    note: v.optional(v.string()),
  }).index("by_handle", ["handleLower"]),

  /** One-off emails to everyone who reserved. `kind` is unique (one launch email). */
  announcements: defineTable({
    kind: v.literal("launch"),
    subject: v.string(),
    body: v.string(),
    status: v.union(v.literal("sending"), v.literal("sent")),
    recipients: v.number(),
  }).index("by_kind", ["kind"]),

  /**
   * Audit log: one row per privileged action, written in the same mutation as
   * the action. `actorId` is unset for CLI/dashboard runs. `targetUsername` is
   * a snapshot so the record survives the target renaming or erasing their
   * account (the erasure cascade unsets `targetId`/`actorId`, not the row).
   */
  adminActions: defineTable({
    actorId: v.optional(v.id("profiles")),
    action: adminAction,
    targetId: v.optional(v.id("profiles")),
    targetUsername: v.optional(v.string()),
    reason: v.optional(v.string()),
    details: v.optional(v.string()),
  })
    .index("by_actor", ["actorId"])
    .index("by_target", ["targetId"])
    .index("by_target_action", ["targetId", "action"])
    .index("by_action", ["action"]),

  /**
   * Single-row server config. `signupMode` decides the tier new accounts get —
   * never client input. Missing row ⇒ "reservation".
   */
  appConfig: defineTable({
    key: v.literal("singleton"),
    signupMode,
  }).index("by_key", ["key"]),
});
