import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { bump, deleteCommentCascade, deleteCommunityCascade, deletePostCascade, removeMembership } from "./cascade";
import { parseSignupMeta, randomToken, usernameFromIdentity } from "./signup";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

async function usernameTaken(ctx: MutationCtx, username: string) {
  const hit = await ctx.db
    .query("profiles")
    .withIndex("by_usernameLower", (q) => q.eq("usernameLower", username.toLowerCase()))
    .first();
  return hit !== null;
}

async function uniqueReferralCode(ctx: MutationCtx) {
  for (;;) {
    const code = randomToken(10);
    const clash = await ctx.db
      .query("reservations")
      .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
      .first();
    if (!clash) return code;
  }
}

type AuthUser = {
  _id: string;
  email: string;
  name?: string | null;
  signupMeta?: string | null;
};

/**
 * Runs in the same transaction that creates the Better Auth user (trigger), so
 * a user never exists without a profile. Replaces the `handle_new_user` SQL
 * trigger:
 *  - username from the signup form, else derived from email/name; de-duplicated
 *    on collision (the auth hook already rejected the common "taken" case);
 *  - the access tier comes from `appConfig.signupMode`, never from the client;
 *  - in reservation mode a reservation row (survey + referral) is recorded.
 */
export async function createProfileForAuthUser(ctx: MutationCtx, user: AuthUser) {
  const existing = await ctx.db
    .query("profiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", user._id))
    .unique();
  if (existing) return existing._id;

  const meta = parseSignupMeta(user.signupMeta);

  let username =
    meta.username && USERNAME_RE.test(meta.username)
      ? meta.username
      : usernameFromIdentity(user.email, user.name);
  for (let i = 0; await usernameTaken(ctx, username); i++) {
    username = `u_${randomToken(i < 5 ? 8 : 12)}`;
  }

  const config = await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", "singleton"))
    .unique();
  const accessLevel = (config?.signupMode ?? "reservation") === "reservation" ? "reserved" : "full";

  const profileId = await ctx.db.insert("profiles", {
    authUserId: user._id,
    username,
    usernameLower: username.toLowerCase(),
    accessLevel,
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
  });

  if (accessLevel === "reserved") {
    const referralCode = await uniqueReferralCode(ctx);
    let referredBy: string | undefined;
    if (meta.referredBy) {
      const referrer = await ctx.db
        .query("reservations")
        .withIndex("by_referralCode", (q) => q.eq("referralCode", meta.referredBy!))
        .first();
      if (referrer) referredBy = referrer.referralCode;
    }
    await ctx.db.insert("reservations", {
      profileId,
      reasons: meta.reasons,
      dailySocialMinutes: meta.dailyMinutes,
      referralCode,
      referredBy,
    });
  }
  return profileId;
}

/**
 * Right to erasure. Runs when the Better Auth user is deleted (trigger), in the
 * same transaction: every row the user owns goes, counters on other people's
 * content are corrected, and uploaded files are removed from storage.
 */
export async function deleteAllDataForAuthUser(ctx: MutationCtx, authUserId: string) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (!profile) return;
  const me = profile._id;

  // Communities they created go entirely (posts, members, invites).
  const created = await ctx.db
    .query("communities")
    .withIndex("by_creator", (q) => q.eq("creatorId", me))
    .collect();
  for (const c of created) await deleteCommunityCascade(ctx, c);

  const posts = await ctx.db
    .query("posts")
    .withIndex("by_author", (q) => q.eq("authorId", me))
    .collect();
  for (const p of posts) await deletePostCascade(ctx, p);

  // Comments on other people's posts (re-read: replies may already be gone).
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_author", (q) => q.eq("authorId", me))
    .collect();
  for (const c of comments) {
    if (await ctx.db.get(c._id)) await deleteCommentCascade(ctx, c);
  }

  const likes = await ctx.db
    .query("likes")
    .withIndex("by_user", (q) => q.eq("userId", me))
    .collect();
  for (const l of likes) {
    await ctx.db.delete(l._id);
    await bump(ctx, l.postId, "likeCount", -1);
  }

  const following = await ctx.db
    .query("follows")
    .withIndex("by_follower", (q) => q.eq("followerId", me))
    .collect();
  for (const f of following) {
    await ctx.db.delete(f._id);
    await bump(ctx, f.followingId, "followerCount", -1);
  }
  const followers = await ctx.db
    .query("follows")
    .withIndex("by_following", (q) => q.eq("followingId", me))
    .collect();
  for (const f of followers) {
    await ctx.db.delete(f._id);
    await bump(ctx, f.followerId, "followingCount", -1);
  }

  const memberships = await ctx.db
    .query("communityMembers")
    .withIndex("by_user", (q) => q.eq("userId", me))
    .collect();
  for (const m of memberships) await removeMembership(ctx, m);

  const invites: Doc<"communityInvites">[] = [
    ...(await ctx.db
      .query("communityInvites")
      .withIndex("by_inviter", (q) => q.eq("inviterId", me))
      .collect()),
    ...(await ctx.db
      .query("communityInvites")
      .withIndex("by_invitee", (q) => q.eq("inviteeId", me))
      .collect()),
  ];
  for (const i of invites) if (await ctx.db.get(i._id)) await ctx.db.delete(i._id);

  const notifications = [
    ...(await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect()),
    ...(await ctx.db
      .query("notifications")
      .withIndex("by_actor", (q) => q.eq("actorId", me))
      .collect()),
  ];
  for (const n of notifications) if (await ctx.db.get(n._id)) await ctx.db.delete(n._id);

  const reservation = await ctx.db
    .query("reservations")
    .withIndex("by_profile", (q) => q.eq("profileId", me))
    .unique();
  if (reservation) {
    const referred = await ctx.db
      .query("reservations")
      .withIndex("by_referredBy", (q) => q.eq("referredBy", reservation.referralCode))
      .collect();
    for (const r of referred) await ctx.db.patch(r._id, { referredBy: undefined });
    await ctx.db.delete(reservation._id);
  }

  const admin = await ctx.db
    .query("adminUsers")
    .withIndex("by_profile", (q) => q.eq("profileId", me))
    .unique();
  if (admin) await ctx.db.delete(admin._id);

  // Audit rows outlive the account (moderation record); only the link goes.
  const audited = [
    ...(await ctx.db
      .query("adminActions")
      .withIndex("by_actor", (q) => q.eq("actorId", me))
      .collect()),
    ...(await ctx.db
      .query("adminActions")
      .withIndex("by_target", (q) => q.eq("targetId", me))
      .collect()),
  ];
  for (const a of audited) {
    await ctx.db.patch(a._id, {
      ...(a.actorId === me ? { actorId: undefined } : {}),
      ...(a.targetId === me ? { targetId: undefined } : {}),
    });
  }

  if (profile.avatarId) await ctx.storage.delete(profile.avatarId);
  await ctx.db.delete(me);
}
