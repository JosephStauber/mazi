import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deny, getViewer, isAdmin, isSuspended, requireAdmin } from "./lib/access";
import { avatarUrl, iso } from "./lib/dto";
import { nullable, paginated } from "./lib/returns";
import { parseOrDeny } from "./lib/validate";
import { adminAction, signupMode } from "./schema";
import { authComponent } from "./auth";
import { suspendReasonSchema } from "../lib/validators/admin";

/** Rows the reservation list returns (mirrors RESERVATION_LIST_LIMIT). */
const LIST_LIMIT = 2000;

export const amIAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    return !!viewer && !isSuspended(viewer) && (await isAdmin(ctx, viewer._id));
  },
});

/** Write one audit row. Call it inside the mutation that performs the action. */
async function audit(
  ctx: MutationCtx,
  row: {
    actorId?: Id<"profiles">;
    action: Doc<"adminActions">["action"];
    target?: Doc<"profiles">;
    reason?: string;
    details?: string;
  }
) {
  await ctx.db.insert("adminActions", {
    actorId: row.actorId,
    action: row.action,
    targetId: row.target?._id,
    targetUsername: row.target?.username,
    reason: row.reason,
    details: row.details,
  });
}

const adminUserV = v.object({
  id: v.string(),
  username: v.string(),
  avatar_url: nullable(v.string()),
  access_level: v.union(v.literal("reserved"), v.literal("full")),
  created_at: v.string(),
  post_count: v.number(),
  follower_count: v.number(),
  is_admin: v.boolean(),
  suspended_at: nullable(v.string()),
  suspended_reason: nullable(v.string()),
});

async function toAdminUser(ctx: QueryCtx, p: Doc<"profiles">) {
  return {
    id: p._id,
    username: p.username,
    avatar_url: await avatarUrl(ctx, p),
    access_level: p.accessLevel,
    created_at: iso(p._creationTime),
    post_count: p.postCount,
    follower_count: p.followerCount,
    is_admin: await isAdmin(ctx, p._id),
    suspended_at: p.suspendedAt !== undefined ? iso(p.suspendedAt) : null,
    suspended_reason: p.suspendedReason ?? null,
  };
}

/** Every account, newest first, or only suspended ones. Admin-only; no emails. */
export const users = query({
  args: {
    filter: v.union(v.literal("all"), v.literal("suspended")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginated(adminUserV),
  handler: async (ctx, { filter, paginationOpts }) => {
    await requireAdmin(ctx);
    const result =
      filter === "suspended"
        ? await ctx.db
            .query("profiles")
            .withIndex("by_suspendedAt", (q) => q.gt("suspendedAt", 0))
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db.query("profiles").order("desc").paginate(paginationOpts);
    const page = [];
    for (const p of result.page) page.push(await toAdminUser(ctx, p));
    return { ...result, page };
  },
});

/** Case-insensitive handle-prefix lookup. Admin-only. */
export const searchUsers = query({
  args: { query: v.string() },
  returns: v.array(adminUserV),
  handler: async (ctx, { query: raw }) => {
    await requireAdmin(ctx);
    const term = raw.trim().replace(/^@/, "").toLowerCase();
    if (!term) return [];
    const rows = await ctx.db
      .query("profiles")
      .withIndex("by_usernameLower", (q) =>
        q.gte("usernameLower", term).lt("usernameLower", term + "￿")
      )
      .take(25);
    const out = [];
    for (const p of rows) out.push(await toAdminUser(ctx, p));
    return out;
  },
});

/**
 * Lock an account out of the app (`requireViewer` enforces it everywhere).
 * The reason is shown to the user. Admins can't be suspended.
 */
export const suspendUser = mutation({
  args: { profileId: v.id("profiles"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { profileId, reason }) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(profileId);
    if (!target) deny("User not found");
    if (target._id === admin._id) deny("You can't suspend yourself");
    if (await isAdmin(ctx, target._id)) deny("Admins can't be suspended");
    if (isSuspended(target)) deny("Already suspended");
    const why = parseOrDeny(suspendReasonSchema, reason);

    await ctx.db.patch(target._id, { suspendedAt: Date.now(), suspendedReason: why });
    await audit(ctx, { actorId: admin._id, action: "suspend", target, reason: why });
    return null;
  },
});

export const unsuspendUser = mutation({
  args: { profileId: v.id("profiles") },
  returns: v.null(),
  handler: async (ctx, { profileId }) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(profileId);
    if (!target) deny("User not found");
    if (!isSuspended(target)) deny("Not suspended");

    await ctx.db.patch(target._id, { suspendedAt: undefined, suspendedReason: undefined });
    await audit(ctx, { actorId: admin._id, action: "unsuspend", target });
    return null;
  },
});

/** The audit log, newest first. Admin-only. */
export const auditLog = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginated(
    v.object({
      id: v.string(),
      action: adminAction,
      /** null = CLI/dashboard run, or an admin who has since erased their account. */
      actor_username: nullable(v.string()),
      target_username: nullable(v.string()),
      reason: nullable(v.string()),
      details: nullable(v.string()),
      created_at: v.string(),
    })
  ),
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db.query("adminActions").order("desc").paginate(paginationOpts);
    const page = [];
    for (const a of result.page) {
      const actor = a.actorId ? await ctx.db.get(a.actorId) : null;
      page.push({
        id: a._id,
        action: a.action,
        actor_username: actor?.username ?? null,
        target_username: a.targetUsername ?? null,
        reason: a.reason ?? null,
        details: a.details ?? null,
        created_at: iso(a._creationTime),
      });
    }
    return { ...result, page };
  },
});

const DAY = 24 * 60 * 60 * 1000;

/** Aggregate dashboard metrics. Admin-only. */
export const reservationStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    today: v.number(),
    last7: v.number(),
    last30: v.number(),
    confirmed: v.number(),
    customized: v.number(),
    referred: v.number(),
    avg_minutes: v.union(v.number(), v.null()),
    median_minutes: v.union(v.number(), v.null()),
    sum_minutes: v.number(),
    reasons: v.record(v.string(), v.number()),
    daily: v.array(v.object({ day: v.string(), count: v.number() })),
    minute_buckets: v.array(v.object({ label: v.string(), count: v.number() })),
    top_referrers: v.array(v.object({ username: v.string(), count: v.number() })),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("reservations").order("desc").take(LIST_LIMIT * 5);
    const now = Date.now();
    const startOfToday = new Date(new Date(now).toISOString().slice(0, 10)).getTime();

    let confirmed = 0;
    let customized = 0;
    const profilesById = new Map<string, { username: string }>();
    for (const r of rows) {
      const p = await ctx.db.get(r.profileId);
      if (!p) continue;
      profilesById.set(p._id, { username: p.username });
      if (p.bio || p.avatarId) customized++;
      const u = await authComponent.getAnyUserById(ctx, p.authUserId);
      if (u?.emailVerified) confirmed++;
    }

    const minutes = rows
      .map((r) => r.dailySocialMinutes)
      .filter((m): m is number => typeof m === "number")
      .sort((a, b) => a - b);
    const sum = minutes.reduce((a, b) => a + b, 0);
    const median =
      minutes.length === 0
        ? null
        : minutes.length % 2
          ? minutes[(minutes.length - 1) / 2]
          : (minutes[minutes.length / 2 - 1] + minutes[minutes.length / 2]) / 2;

    const reasons: Record<string, number> = {};
    for (const r of rows) for (const reason of r.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1;

    const daily = Array.from({ length: 30 }, (_, i) => {
      const dayStart = startOfToday - (29 - i) * DAY;
      return {
        day: new Date(dayStart).toISOString().slice(0, 10),
        count: rows.filter((r) => r._creationTime >= dayStart && r._creationTime < dayStart + DAY).length,
      };
    });

    const buckets: [string, number, number][] = [
      ["<1h", 0, 59],
      ["1-2h", 60, 119],
      ["2-3h", 120, 179],
      ["3-4h", 180, 239],
      ["4h+", 240, Infinity],
    ];

    const byCode = new Map(rows.map((r) => [r.referralCode, r]));
    const referrerCounts = new Map<string, number>();
    for (const r of rows) {
      if (!r.referredBy) continue;
      const parent = byCode.get(r.referredBy);
      const name = parent && profilesById.get(parent.profileId)?.username;
      if (name) referrerCounts.set(name, (referrerCounts.get(name) ?? 0) + 1);
    }

    return {
      total: rows.length,
      today: rows.filter((r) => r._creationTime >= startOfToday).length,
      last7: rows.filter((r) => r._creationTime >= now - 7 * DAY).length,
      last30: rows.filter((r) => r._creationTime >= now - 30 * DAY).length,
      confirmed,
      customized,
      referred: rows.filter((r) => r.referredBy).length,
      avg_minutes: minutes.length ? Math.round(sum / minutes.length) : null,
      median_minutes: median,
      sum_minutes: sum,
      reasons,
      daily,
      minute_buckets: buckets.map(([label, lo, hi]) => ({
        label,
        count: minutes.filter((m) => m >= lo && m <= hi).length,
      })),
      top_referrers: [...referrerCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([username, count]) => ({ username, count })),
    };
  },
});

/**
 * Per-signup rows **including email** — the only path that exposes reservation
 * emails to a client, and only to allowlisted admins.
 */
export const reservationList = query({
  args: {},
  returns: v.array(
    v.object({
      username: v.string(),
      email: v.string(),
      email_confirmed: v.boolean(),
      reasons: v.array(v.string()),
      daily_social_minutes: v.union(v.number(), v.null()),
      referral_code: v.string(),
      referred_by: v.union(v.string(), v.null()),
      referral_count: v.number(),
      bio_set: v.boolean(),
      avatar_set: v.boolean(),
      created_at: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("reservations").order("desc").take(LIST_LIMIT);
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.referredBy) counts.set(r.referredBy, (counts.get(r.referredBy) ?? 0) + 1);
    }
    const out = [];
    for (const r of rows) {
      const p = await ctx.db.get(r.profileId);
      if (!p) continue;
      const u = await authComponent.getAnyUserById(ctx, p.authUserId);
      out.push({
        username: p.username,
        email: u?.email ?? "",
        email_confirmed: !!u?.emailVerified,
        reasons: r.reasons,
        daily_social_minutes: r.dailySocialMinutes ?? null,
        referral_code: r.referralCode,
        referred_by: r.referredBy ?? null,
        referral_count: counts.get(r.referralCode) ?? 0,
        bio_set: !!p.bio,
        avatar_set: !!p.avatarId,
        created_at: iso(r._creationTime),
      });
    }
    return out;
  },
});

/**
 * Add an admin (privilege grant — run deliberately from the CLI/dashboard):
 *   npx convex run admin:grant '{"username": "you"}'
 */
export const grant = internalMutation({
  args: { username: v.string() },
  returns: v.null(),
  handler: async (ctx, { username }) => {
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", username.toLowerCase()))
      .unique();
    if (!p) throw new Error(`No profile @${username}`);
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_profile", (q) => q.eq("profileId", p._id))
      .unique();
    if (!existing) {
      await ctx.db.insert("adminUsers", { profileId: p._id });
      await audit(ctx, { action: "grant_admin", target: p });
    }
    return null;
  },
});

/**
 * Flip signup mode. At launch: `npx convex run admin:setSignupMode '{"mode":"open"}'`
 * (and set NEXT_PUBLIC_LAUNCH_MODE=open for the UI). `promoteReserved: true`
 * also moves up to 1000 reserved accounts per call to full access — repeat
 * until none are left.
 */
export const setSignupMode = internalMutation({
  args: { mode: signupMode, promoteReserved: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { mode, promoteReserved }) => {
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();
    if (row) await ctx.db.patch(row._id, { signupMode: mode });
    else await ctx.db.insert("appConfig", { key: "singleton", signupMode: mode });

    let promoted = 0;
    if (promoteReserved) {
      // One batch per call keeps the transaction small; re-run as needed.
      const batch = await ctx.db
        .query("profiles")
        .withIndex("by_accessLevel", (q) => q.eq("accessLevel", "reserved"))
        .take(1000);
      for (const p of batch) await ctx.db.patch(p._id, { accessLevel: "full" });
      promoted = batch.length;
    }
    await audit(ctx, {
      action: "set_signup_mode",
      details: promoteReserved ? `${mode}, promoted ${promoted} reserved` : mode,
    });
    return null;
  },
});
