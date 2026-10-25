import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { deny, getMembership, requireAdmin, requireOwner } from "./lib/access";
import { deleteCommunityCascade } from "./lib/cascade";
import { iso } from "./lib/dto";
import { audit, notifyByEmail } from "./lib/moderation";
import { nullable, paginated } from "./lib/returns";
import { parseOrDeny } from "./lib/validate";
import { privacyType } from "./schema";
import { suspendReasonSchema } from "../lib/validators/admin";

/**
 * Community metadata only — admins don't get a back door into invite-only
 * posts. Removal and ownership transfer are owner-only and audited.
 */

const communityRowV = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
  privacy: privacyType,
  member_count: v.number(),
  creator_id: v.string(),
  creator_username: nullable(v.string()),
  created_at: v.string(),
});

async function toRow(ctx: QueryCtx, c: Doc<"communities">) {
  const creator = await ctx.db.get(c.creatorId);
  return {
    id: c._id,
    name: c.name,
    slug: c.slug,
    privacy: c.privacyType,
    member_count: c.memberCount,
    creator_id: c.creatorId,
    creator_username: creator?.username ?? null,
    created_at: iso(c._creationTime),
  };
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginated(communityRowV),
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db.query("communities").order("desc").paginate(paginationOpts);
    const page = [];
    for (const c of result.page) page.push(await toRow(ctx, c));
    return { ...result, page };
  },
});

export const search = query({
  args: { query: v.string() },
  returns: v.array(communityRowV),
  handler: async (ctx, { query: raw }) => {
    await requireAdmin(ctx);
    const term = raw.trim();
    if (!term) return [];
    const rows = await ctx.db
      .query("communities")
      .withSearchIndex("search_name", (q) => q.search("name", term))
      .take(25);
    const out = [];
    for (const c of rows) out.push(await toRow(ctx, c));
    return out;
  },
});

/** Delete a community and everything in it. The creator is emailed the reason. */
export const takedown = mutation({
  args: { communityId: v.id("communities"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { communityId, reason }) => {
    const admin = await requireOwner(ctx);
    const community = await ctx.db.get(communityId);
    if (!community) deny("Community not found");
    const why = parseOrDeny(suspendReasonSchema, reason);
    const creator = await ctx.db.get(community.creatorId);

    await deleteCommunityCascade(ctx, community);
    if (creator) {
      await notifyByEmail(ctx, creator, "A community you created was removed", [
        `Hi @${creator.username},`,
        `We removed your community "${community.name}" because it broke the community guidelines.`,
        `Reason: ${why}`,
      ]);
    }
    await audit(ctx, {
      actorId: admin._id,
      action: "community_takedown",
      target: creator ?? undefined,
      reason: why,
      details: `${community.name} (/${community.slug}), ${community.memberCount} members`,
    });
    return null;
  },
});

/** Hand a community to one of its members (e.g. the creator left or was removed). */
export const transfer = mutation({
  args: { communityId: v.id("communities"), username: v.string() },
  returns: v.null(),
  handler: async (ctx, { communityId, username }) => {
    const admin = await requireOwner(ctx);
    const community = await ctx.db.get(communityId);
    if (!community) deny("Community not found");
    const next = await ctx.db
      .query("profiles")
      .withIndex("by_usernameLower", (q) =>
        q.eq("usernameLower", username.trim().replace(/^@/, "").toLowerCase())
      )
      .unique();
    if (!next) deny("No user with that handle");
    if (next._id === community.creatorId) deny("They already own it");
    const nextMembership = await getMembership(ctx, community._id, next._id);
    if (!nextMembership) deny("The new owner must already be a member");

    const prevMembership = await getMembership(ctx, community._id, community.creatorId);
    if (prevMembership) await ctx.db.patch(prevMembership._id, { role: "member" });
    await ctx.db.patch(nextMembership._id, { role: "creator" });
    await ctx.db.patch(community._id, { creatorId: next._id });

    const prev = await ctx.db.get(community.creatorId);
    await audit(ctx, {
      actorId: admin._id,
      action: "community_transfer",
      target: next,
      details: `${community.name} (/${community.slug}) from @${prev?.username ?? "deleted"}`,
    });
    return null;
  },
});
