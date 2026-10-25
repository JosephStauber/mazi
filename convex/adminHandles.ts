import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { deny, requireAdmin, requireOwner } from "./lib/access";
import { iso } from "./lib/dto";
import { BUILT_IN_BLOCKED_HANDLES } from "./lib/handles";
import { audit } from "./lib/moderation";
import { nullable } from "./lib/returns";
import { parseOrDeny } from "./lib/validate";
import { handleMatch } from "./schema";
import { blockedHandleSchema } from "../lib/validators/admin";

/** Blocked handles: the built-in list plus admin rules. Enforced in lib/handles.ts. */
export const list = query({
  args: {},
  returns: v.object({
    built_in: v.array(v.string()),
    rules: v.array(
      v.object({
        id: v.string(),
        handle: v.string(),
        match: handleMatch,
        note: nullable(v.string()),
        created_at: v.string(),
      })
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("blockedHandles").order("desc").take(1000);
    return {
      built_in: [...BUILT_IN_BLOCKED_HANDLES],
      rules: rows.map((r) => ({
        id: r._id,
        handle: r.handleLower,
        match: r.match,
        note: r.note ?? null,
        created_at: iso(r._creationTime),
      })),
    };
  },
});

/**
 * Block a handle for new signups and renames. Existing accounts keep theirs —
 * use "Reset profile → handle" for those.
 */
export const block = mutation({
  args: { handle: v.string(), match: handleMatch, note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { handle, match, note }) => {
    const admin = await requireOwner(ctx);
    const lower = parseOrDeny(blockedHandleSchema, handle);
    const existing = await ctx.db
      .query("blockedHandles")
      .withIndex("by_handle", (q) => q.eq("handleLower", lower))
      .first();
    if (existing) deny("Already blocked");
    const cleanNote = note?.trim().slice(0, 200) || undefined;
    await ctx.db.insert("blockedHandles", { handleLower: lower, match, note: cleanNote });
    // Logged without the handle text when it's a substring rule (often a slur).
    await audit(ctx, {
      actorId: admin._id,
      action: "block_handle",
      details: match === "exact" ? `@${lower}` : `substring rule (${lower.length} chars)`,
    });
    return null;
  },
});

export const unblock = mutation({
  args: { id: v.id("blockedHandles") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const admin = await requireOwner(ctx);
    const row = await ctx.db.get(id);
    if (!row) return null;
    await ctx.db.delete(id);
    await audit(ctx, {
      actorId: admin._id,
      action: "unblock_handle",
      details: row.match === "exact" ? `@${row.handleLower}` : "substring rule",
    });
    return null;
  },
});
