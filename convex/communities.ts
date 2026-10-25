import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  deny,
  getMembership,
  isModeratorRole,
  requireFullAccess,
} from "./lib/access";
import { bump, deleteCommunityCascade, removeMembership } from "./lib/cascade";
import { refLoader, toCommunityDTO } from "./lib/dto";
import { notify } from "./lib/notify";
import { enforceRateLimit } from "./lib/rateLimit";
import { communityRoleV, communityV, paginated, profileRefV } from "./lib/returns";
import { randomToken } from "./lib/signup";
import { parseOrDeny } from "./lib/validate";
import { createCommunitySchema, updateCommunitySchema } from "../lib/validators/community";

const privacyArg = v.union(v.literal("public"), v.literal("invite_only"));

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Every community (discover list), newest first, with the viewer's role. */
export const list = query({
  args: {},
  returns: v.array(communityV),
  handler: async (ctx) => {
    const viewer = await requireFullAccess(ctx);
    const rows = await ctx.db.query("communities").order("desc").take(200);
    return await Promise.all(rows.map((c) => toCommunityDTO(ctx, viewer, c)));
  },
});

export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(communityV, v.null()),
  handler: async (ctx, { slug }) => {
    const viewer = await requireFullAccess(ctx);
    const c = await ctx.db
      .query("communities")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return c ? await toCommunityDTO(ctx, viewer, c) : null;
  },
});

/** Members, oldest first. Membership lists are visible to any full user (as before). */
export const members = query({
  args: { communityId: v.id("communities"), paginationOpts: paginationOptsValidator },
  returns: paginated(
    v.object({ id: v.string(), role: communityRoleV, created_at: v.string(), profile: profileRefV })
  ),
  handler: async (ctx, { communityId, paginationOpts }) => {
    await requireFullAccess(ctx);
    const rows = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .order("asc")
      .paginate(paginationOpts);
    const load = refLoader(ctx);
    const page = await Promise.all(
      rows.page.map(async (m) => {
        const profile = await load(m.userId);
        return profile
          ? { id: m._id, role: m.role, created_at: new Date(m._creationTime).toISOString(), profile }
          : null;
      })
    );
    return { ...rows, page: page.filter((m) => m !== null) };
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()), privacyType: privacyArg },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireFullAccess(ctx);
    await enforceRateLimit(ctx, "createCommunity", viewer._id);
    const data = parseOrDeny(createCommunitySchema, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      privacy_type: args.privacyType,
    });
    const slug = `${slugify(data.name) || "community"}-${randomToken(6).toLowerCase()}`;
    const communityId = await ctx.db.insert("communities", {
      name: data.name,
      slug,
      description: data.description,
      creatorId: viewer._id,
      privacyType: data.privacy_type,
      memberCount: 1,
    });
    await ctx.db.insert("communityMembers", { communityId, userId: viewer._id, role: "creator" });
    return { slug };
  },
});

async function requireCreator(
  ctx: Parameters<typeof requireFullAccess>[0],
  communityId: Doc<"communities">["_id"]
) {
  const viewer = await requireFullAccess(ctx);
  const community = await ctx.db.get(communityId);
  if (!community || community.creatorId !== viewer._id) {
    deny("Only the community creator can do that");
  }
  return { viewer, community };
}

export const update = mutation({
  args: {
    communityId: v.id("communities"),
    name: v.string(),
    description: v.optional(v.string()),
    privacyType: privacyArg,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCreator(ctx, args.communityId);
    const data = parseOrDeny(updateCommunitySchema, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      privacy_type: args.privacyType,
    });
    await ctx.db.patch(args.communityId, {
      name: data.name,
      description: data.description,
      privacyType: data.privacy_type,
    });
    return null;
  },
});

export const remove = mutation({
  args: { communityId: v.id("communities") },
  returns: v.null(),
  handler: async (ctx, { communityId }) => {
    const { community } = await requireCreator(ctx, communityId);
    await deleteCommunityCascade(ctx, community);
    return null;
  },
});

/** Self-join — public communities only; invite-only goes through invites. */
export const join = mutation({
  args: { communityId: v.id("communities") },
  returns: v.null(),
  handler: async (ctx, { communityId }) => {
    const viewer = await requireFullAccess(ctx);
    const community = await ctx.db.get(communityId);
    if (!community) deny("Community not found");
    if (community.privacyType !== "public") deny("This community is invite only");
    if (await getMembership(ctx, communityId, viewer._id)) deny("Already a member");
    await ctx.db.insert("communityMembers", { communityId, userId: viewer._id, role: "member" });
    await bump(ctx, communityId, "memberCount", 1);
    return null;
  },
});

export const leave = mutation({
  args: { communityId: v.id("communities") },
  returns: v.null(),
  handler: async (ctx, { communityId }) => {
    const viewer = await requireFullAccess(ctx);
    const m = await getMembership(ctx, communityId, viewer._id);
    if (!m) return null;
    if (m.role === "creator") deny("The creator can't leave — delete the community instead");
    await removeMembership(ctx, m);
    return null;
  },
});

async function requireModerator(
  ctx: Parameters<typeof requireFullAccess>[0],
  communityId: Doc<"communities">["_id"]
) {
  const viewer = await requireFullAccess(ctx);
  const m = await getMembership(ctx, communityId, viewer._id);
  if (!isModeratorRole(m?.role)) deny("Only moderators can invite people");
  return viewer;
}

export const inviteByUsername = mutation({
  args: { communityId: v.id("communities"), username: v.string() },
  returns: v.null(),
  handler: async (ctx, { communityId, username }) => {
    const viewer = await requireModerator(ctx, communityId);
    await enforceRateLimit(ctx, "invite", viewer._id);
    const target = await ctx.db
      .query("profiles")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", username.trim().toLowerCase()))
      .unique();
    if (!target || target.accessLevel !== "full") deny("User not found");
    if (await getMembership(ctx, communityId, target._id)) deny("User is already a member");
    const pending = await ctx.db
      .query("communityInvites")
      .withIndex("by_community_invitee", (q) =>
        q.eq("communityId", communityId).eq("inviteeId", target._id)
      )
      .collect();
    if (pending.some((i) => i.status === "pending")) deny("They already have a pending invite");

    const inviteId = await ctx.db.insert("communityInvites", {
      communityId,
      inviterId: viewer._id,
      inviteeId: target._id,
      status: "pending",
    });
    await notify(ctx, {
      userId: target._id,
      actorId: viewer._id,
      type: "community_invite",
      communityId,
      inviteId,
    });
    return null;
  },
});

/** A reusable invite link; returns the token (the client builds the URL). */
export const createInviteLink = mutation({
  args: { communityId: v.id("communities") },
  returns: v.string(),
  handler: async (ctx, { communityId }) => {
    const viewer = await requireModerator(ctx, communityId);
    await enforceRateLimit(ctx, "invite", viewer._id);
    const token = randomToken(24);
    await ctx.db.insert("communityInvites", {
      communityId,
      inviterId: viewer._id,
      token,
      status: "pending",
    });
    return token;
  },
});

/** Resolve a link token to public community fields (pending + unexpired only). */
export const inviteByToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("communityInvites"),
      community: v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
        description: v.union(v.string(), v.null()),
      }),
    })
  ),
  handler: async (ctx, { token }) => {
    await requireFullAccess(ctx);
    if (!token) return null;
    const invite = await ctx.db
      .query("communityInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite || invite.status !== "pending") return null;
    if (invite.expiresAt && invite.expiresAt < Date.now()) return null;
    const c = await ctx.db.get(invite.communityId);
    if (!c) return null;
    return {
      id: invite._id,
      community: { id: c._id, name: c.name, slug: c.slug, description: c.description ?? null },
    };
  },
});

/**
 * Accept an invite (was the `accept_invite` RPC). Link invites stay reusable;
 * targeted invites are single-use, only for their invitee, and only from
 * `pending` — so someone removed can't rejoin with an old invite (00006/E).
 */
export const acceptInvite = mutation({
  args: { inviteId: v.id("communityInvites") },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, { inviteId }) => {
    const viewer = await requireFullAccess(ctx);
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.status !== "pending") deny("Invite not found or already used");
    if (invite.expiresAt && invite.expiresAt < Date.now()) deny("This invite has expired");
    if (invite.inviteeId && invite.inviteeId !== viewer._id) deny("Invite not found or already used");
    const community = await ctx.db.get(invite.communityId);
    if (!community) deny("Community not found");

    if (!(await getMembership(ctx, community._id, viewer._id))) {
      await ctx.db.insert("communityMembers", {
        communityId: community._id,
        userId: viewer._id,
        role: "member",
      });
      await bump(ctx, community._id, "memberCount", 1);
    }
    if (invite.inviteeId) await ctx.db.patch(inviteId, { status: "accepted" });
    return { slug: community.slug };
  },
});

/** A targeted invitee declines their own pending invite (was `decline_invite`). */
export const declineInvite = mutation({
  args: { inviteId: v.id("communityInvites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const viewer = await requireFullAccess(ctx);
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.inviteeId !== viewer._id || invite.status !== "pending") {
      deny("Invite not found or already handled");
    }
    await ctx.db.patch(inviteId, { status: "declined" });
    return null;
  },
});
