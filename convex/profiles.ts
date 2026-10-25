import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  deny,
  getViewer,
  requireFullAccess,
  requireViewer,
  type Viewer,
} from "./lib/access";
import { toProfile, toProfileListItem, toProfileRef } from "./lib/dto";
import { communityRefV, paginated, profileListItemV, profileRefV, profileV } from "./lib/returns";
import { enforceRateLimit } from "./lib/rateLimit";
import { syncReservationCustomized } from "./lib/reservationStats";
import { parseOrDeny } from "./lib/validate";
import { claimImage } from "./files";
import { updateProfileSchema } from "../lib/validators/profile";
import { AVATAR_MAX_BYTES } from "../lib/validators/post";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

async function byUsernameLower(ctx: QueryCtx, username: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_usernameLower", (q) => q.eq("usernameLower", username.toLowerCase()))
    .unique();
}

/** The signed-in user's own profile (any access tier), or null. */
export const me = query({
  args: {},
  returns: v.union(profileV, v.null()),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    return viewer ? await toProfile(ctx, viewer) : null;
  },
});

/** Used by the signup auth hook for a friendly "taken" error. */
export const isUsernameTaken = internalQuery({
  args: { username: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { username }) => (await byUsernameLower(ctx, username)) !== null,
});

/**
 * Reserve-funnel availability check — callable before signup, so it's public.
 * It returns only a boolean (handles are public on the platform anyway).
 */
export const usernameAvailable = query({
  args: { username: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { username }) => {
    const trimmed = username.trim();
    if (!USERNAME_RE.test(trimmed)) return false;
    return (await byUsernameLower(ctx, trimmed)) === null;
  },
});

async function isFollowing(ctx: QueryCtx, viewer: Viewer, targetId: Id<"profiles">) {
  const row = await ctx.db
    .query("follows")
    .withIndex("by_follower_following", (q) =>
      q.eq("followerId", viewer._id).eq("followingId", targetId)
    )
    .unique();
  return row !== null;
}

/** Everything the profile page header renders. */
export const byUsername = query({
  args: { username: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      profile: profileV,
      followers: v.number(),
      following: v.number(),
      posts_count: v.number(),
      is_own: v.boolean(),
      is_following: v.boolean(),
      communities: v.array(communityRefV),
    })
  ),
  handler: async (ctx, { username }) => {
    const viewer = await requireFullAccess(ctx);
    let handle = username.trim();
    try {
      handle = decodeURIComponent(handle);
    } catch {
      /* keep raw */
    }
    const profile = await byUsernameLower(ctx, handle);
    if (!profile || profile.accessLevel !== "full") return null;

    const memberships = await ctx.db
      .query("communityMembers")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
      .collect();
    const communities = (
      await Promise.all(memberships.map((m) => ctx.db.get(m.communityId)))
    )
      .filter((c): c is Doc<"communities"> => c !== null)
      .map((c) => ({ id: c._id, name: c.name, slug: c.slug }));

    const isOwn = profile._id === viewer._id;
    return {
      profile: await toProfile(ctx, profile),
      followers: profile.followerCount,
      following: profile.followingCount,
      posts_count: profile.postCount,
      is_own: isOwn,
      is_following: isOwn ? false : await isFollowing(ctx, viewer, profile._id),
      communities,
    };
  },
});

export const update = mutation({
  args: { username: v.optional(v.string()), bio: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Reserved accounts may set up their profile before launch.
    const viewer = await requireViewer(ctx);
    await enforceRateLimit(ctx, "profile", viewer._id);
    const data = parseOrDeny(updateProfileSchema, {
      ...(args.username ? { username: args.username.trim() } : {}),
      ...(args.bio !== undefined ? { bio: args.bio } : {}),
    });
    const patch: Partial<Doc<"profiles">> = {};
    if (data.username && data.username !== viewer.username) {
      const clash = await byUsernameLower(ctx, data.username);
      if (clash && clash._id !== viewer._id) deny("Username is already taken");
      patch.username = data.username;
      patch.usernameLower = data.username.toLowerCase();
    }
    if (data.bio !== undefined) patch.bio = data.bio.trim() || undefined;
    await ctx.db.patch(viewer._id, patch);
    if (data.bio !== undefined) await syncReservationCustomized(ctx, viewer._id);
    return null;
  },
});

export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const viewer = await requireViewer(ctx);
    await enforceRateLimit(ctx, "profile", viewer._id);
    await claimImage(ctx, storageId, AVATAR_MAX_BYTES);
    const previous = viewer.avatarId;
    await ctx.db.patch(viewer._id, { avatarId: storageId });
    if (previous) await ctx.storage.delete(previous);
    await syncReservationCustomized(ctx, viewer._id);
    return null;
  },
});

async function userListPage(
  ctx: QueryCtx,
  viewer: Viewer,
  rows: { page: Doc<"follows">[]; isDone: boolean; continueCursor: string },
  pick: (f: Doc<"follows">) => Id<"profiles">
) {
  const page = await Promise.all(
    rows.page.map(async (f) => {
      const p = await ctx.db.get(pick(f));
      if (!p) return null;
      return {
        ...(await toProfileListItem(ctx, p)),
        followed_by_viewer: p._id === viewer._id ? false : await isFollowing(ctx, viewer, p._id),
      };
    })
  );
  return { ...rows, page: page.filter((x) => x !== null) };
}

const userPageV = paginated(v.object({ ...profileListItemV.fields, followed_by_viewer: v.boolean() }));

/** People following `userId`, newest first. */
export const followers = query({
  args: { userId: v.id("profiles"), paginationOpts: paginationOptsValidator },
  returns: userPageV,
  handler: async (ctx, { userId, paginationOpts }) => {
    const viewer = await requireFullAccess(ctx);
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", userId))
      .order("desc")
      .paginate(paginationOpts);
    return await userListPage(ctx, viewer, rows, (f) => f.followerId);
  },
});

/** People `userId` follows, newest first. */
export const following = query({
  args: { userId: v.id("profiles"), paginationOpts: paginationOptsValidator },
  returns: userPageV,
  handler: async (ctx, { userId, paginationOpts }) => {
    const viewer = await requireFullAccess(ctx);
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .order("desc")
      .paginate(paginationOpts);
    return await userListPage(ctx, viewer, rows, (f) => f.followingId);
  },
});

/** @mention autocomplete: handles starting with `prefix`. */
export const mentionCandidates = query({
  args: { prefix: v.string() },
  returns: v.array(profileRefV),
  handler: async (ctx, { prefix }) => {
    await requireFullAccess(ctx);
    const p = prefix.trim().toLowerCase();
    if (!/^[a-z0-9_]{0,30}$/.test(p)) return [];
    // Bounded prefix range on the index; reserved accounts are dropped after.
    const rows = await ctx.db
      .query("profiles")
      .withIndex("by_usernameLower", (q) =>
        p ? q.gte("usernameLower", p).lt("usernameLower", p + "￿") : q
      )
      .take(12);
    return await Promise.all(
      rows
        .filter((r) => r.accessLevel === "full")
        .slice(0, 6)
        .map((r) => toProfileRef(ctx, r))
    );
  },
});

/** Communities the signed-in user belongs to (composer's "post to" picker). */
export const myCommunities = query({
  args: {},
  returns: v.array(communityRefV),
  handler: async (ctx) => {
    const viewer = await requireFullAccess(ctx);
    const memberships = await ctx.db
      .query("communityMembers")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect();
    const communities = await Promise.all(memberships.map((m) => ctx.db.get(m.communityId)));
    return communities
      .filter((c): c is Doc<"communities"> => c !== null)
      .map((c) => ({ id: c._id, name: c.name, slug: c.slug }));
  },
});
