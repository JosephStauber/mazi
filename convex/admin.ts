import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deny, getViewer, isAdmin, isSuspended, requireAdmin } from "./lib/access";
import { avatarUrl, iso } from "./lib/dto";
import { nullable, paginated } from "./lib/returns";
import {
  accumulate,
  dayKey,
  emptyStats,
  readStats,
  updateStats,
} from "./lib/reservationStats";
import { parseOrDeny } from "./lib/validate";
import { adminAction, signupMode } from "./schema";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { suspendReasonSchema } from "../lib/validators/admin";

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

const MINUTE_BUCKETS: [string, number, number][] = [
  ["<1h", 0, 59],
  ["1-2h", 60, 119],
  ["2-3h", 120, 179],
  ["3-4h", 180, 239],
  ["4h+", 240, Infinity],
];

/**
 * Aggregate dashboard metrics. Admin-only. Reads the precomputed
 * `reservationStats` row (lib/reservationStats.ts) plus the top 10 referrers,
 * so its cost doesn't grow with the number of reservations.
 */
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
    const s = (await readStats(ctx)) ?? emptyStats();
    const now = Date.now();

    // Days are UTC calendar days, newest last; "last 7" includes today.
    const days = Array.from({ length: 30 }, (_, i) => dayKey(now - (29 - i) * DAY));
    const daily = days.map((day) => ({ day, count: s.daily[day] ?? 0 }));
    const sumLast = (n: number) => daily.slice(-n).reduce((a, d) => a + d.count, 0);

    // Exact median from the per-minute histogram.
    const histogram = Object.entries(s.minutes)
      .map(([m, count]) => [Number(m), count] as const)
      .sort((a, b) => a[0] - b[0]);
    const answered = histogram.reduce((a, [, c]) => a + c, 0);
    const nth = (k: number) => {
      let seen = 0;
      for (const [m, c] of histogram) {
        seen += c;
        if (seen > k) return m;
      }
      return 0;
    };
    const median =
      answered === 0
        ? null
        : answered % 2
          ? nth((answered - 1) / 2)
          : (nth(answered / 2 - 1) + nth(answered / 2)) / 2;

    const top = await ctx.db
      .query("reservations")
      .withIndex("by_referralCount", (q) => q.gt("referralCount", 0))
      .order("desc")
      .take(10);
    const top_referrers = [];
    for (const r of top) {
      const p = await ctx.db.get(r.profileId);
      if (p) top_referrers.push({ username: p.username, count: r.referralCount ?? 0 });
    }

    return {
      total: s.total,
      today: sumLast(1),
      last7: sumLast(7),
      last30: sumLast(30),
      confirmed: s.confirmed,
      customized: s.customized,
      referred: s.referred,
      avg_minutes: answered ? Math.round(s.sumMinutes / answered) : null,
      median_minutes: median,
      sum_minutes: s.sumMinutes,
      reasons: s.reasons,
      daily,
      minute_buckets: MINUTE_BUCKETS.map(([label, lo, hi]) => ({
        label,
        count: histogram.filter(([m]) => m >= lo && m <= hi).reduce((a, [, c]) => a + c, 0),
      })),
      top_referrers,
    };
  },
});

/**
 * Per-signup rows **including email**, newest first, paginated — the only path
 * that exposes reservation emails to a client, and only to allowlisted admins.
 */
export const reservationList = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginated(
    v.object({
      id: v.string(),
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
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db.query("reservations").order("desc").paginate(paginationOpts);
    const page = [];
    for (const r of result.page) {
      const p = await ctx.db.get(r.profileId);
      if (!p) continue;
      const u = await authComponent.getAnyUserById(ctx, p.authUserId);
      page.push({
        id: r._id,
        username: p.username,
        email: u?.email ?? "",
        email_confirmed: !!u?.emailVerified,
        reasons: r.reasons,
        daily_social_minutes: r.dailySocialMinutes ?? null,
        referral_code: r.referralCode,
        referred_by: r.referredBy ?? null,
        referral_count: r.referralCount ?? 0,
        bio_set: !!p.bio,
        avatar_set: !!p.avatarId,
        created_at: iso(r._creationTime),
      });
    }
    return { ...result, page };
  },
});

/**
 * Recompute the denormalized reservation fields (`emailConfirmed`,
 * `customized`, `referralCount`) and the `reservationStats` row from scratch.
 * Backfill after deploying the stats change, or repair if numbers drift:
 *   npx convex run admin:rebuildReservationStats
 * Works newest-first in batches, scheduling itself until done. Rows created
 * while it runs are counted by their own signup and not visited again.
 */
export const rebuildReservationStats = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ processed: v.number(), done: v.boolean() }),
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db
      .query("reservations")
      .order("desc")
      .paginate({ numItems: 100, cursor: cursor ?? null });

    const rows: Doc<"reservations">[] = [];
    for (const r of result.page) {
      const p = await ctx.db.get(r.profileId);
      const u = p ? await authComponent.getAnyUserById(ctx, p.authUserId) : null;
      const referralCount = (
        await ctx.db
          .query("reservations")
          .withIndex("by_referredBy", (q) => q.eq("referredBy", r.referralCode))
          .collect()
      ).length;
      const fields = {
        emailConfirmed: !!u?.emailVerified,
        customized: !!(p?.bio || p?.avatarId),
        referralCount,
      };
      await ctx.db.patch(r._id, fields);
      rows.push({ ...r, ...fields });
    }
    await updateStats(ctx, (s) => {
      if (!cursor) Object.assign(s, emptyStats()); // first batch starts over
      for (const r of rows) accumulate(s, r, 1);
    });

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.admin.rebuildReservationStats, {
        cursor: result.continueCursor,
      });
    }
    return { processed: rows.length, done: result.isDone };
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
