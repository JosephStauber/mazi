import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { deny, isSuspended, requireAdmin } from "./lib/access";
import { iso } from "./lib/dto";
import { audit, liftSuspension, notifyByEmail } from "./lib/moderation";
import { nullable, paginated } from "./lib/returns";
import { parseOrDeny } from "./lib/validate";
import { appealStatus } from "./schema";
import { appealResponseSchema } from "../lib/validators/admin";

/** Appeals by status, oldest open first (a queue); resolved ones newest first. */
export const list = query({
  args: { status: appealStatus, paginationOpts: paginationOptsValidator },
  returns: paginated(
    v.object({
      id: v.string(),
      profile_id: v.string(),
      username: nullable(v.string()),
      /** The suspension being appealed; null once lifted. */
      suspended_reason: nullable(v.string()),
      body: v.string(),
      status: appealStatus,
      response: nullable(v.string()),
      created_at: v.string(),
      resolved_at: nullable(v.string()),
    })
  ),
  handler: async (ctx, { status, paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("appeals")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order(status === "open" ? "asc" : "desc")
      .paginate(paginationOpts);
    const page = [];
    for (const a of result.page) {
      const p = await ctx.db.get(a.profileId);
      page.push({
        id: a._id,
        profile_id: a.profileId,
        username: p?.username ?? null,
        suspended_reason: p?.suspendedReason ?? null,
        body: a.body,
        status: a.status,
        response: a.response ?? null,
        created_at: iso(a._creationTime),
        resolved_at: a.resolvedAt !== undefined ? iso(a.resolvedAt) : null,
      });
    }
    return { ...result, page };
  },
});

/** Count for the nav badge. */
export const openCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const open = await ctx.db
      .query("appeals")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(100);
    return open.length;
  },
});

/** Accept (restores the account) or reject an appeal. The user is emailed either way. */
export const resolve = mutation({
  args: { appealId: v.id("appeals"), accept: v.boolean(), response: v.string() },
  returns: v.null(),
  handler: async (ctx, { appealId, accept, response }) => {
    const admin = await requireAdmin(ctx);
    const appeal = await ctx.db.get(appealId);
    if (!appeal) deny("Appeal not found");
    if (appeal.status !== "open") deny("Already resolved");
    const target = await ctx.db.get(appeal.profileId);
    if (!target) deny("User not found");
    const reply = parseOrDeny(appealResponseSchema, response) || undefined;

    await ctx.db.patch(appeal._id, {
      status: accept ? "accepted" : "rejected",
      response: reply,
      resolvedAt: Date.now(),
    });
    if (accept) {
      if (isSuspended(target)) {
        await liftSuspension(ctx, { target, actorId: admin._id, via: "appeal", note: reply });
      }
    } else {
      await notifyByEmail(ctx, target, "Your Mazi appeal was reviewed", [
        `Hi @${target.username},`,
        "We reviewed your appeal and the suspension stays in place.",
        ...(reply ? [`From our team: ${reply}`] : []),
      ]);
    }
    await audit(ctx, {
      actorId: admin._id,
      action: accept ? "appeal_accepted" : "appeal_rejected",
      target,
      reason: reply,
    });
    return null;
  },
});
