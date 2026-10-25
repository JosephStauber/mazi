import { v } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { deny, getViewer } from "./lib/access";
import { iso } from "./lib/dto";
import { signupMode } from "./schema";
import { authComponent } from "./auth";

/** Rows the reservation list returns (mirrors RESERVATION_LIST_LIMIT). */
const LIST_LIMIT = 2000;

async function isAdmin(ctx: QueryCtx) {
  const viewer = await getViewer(ctx);
  if (!viewer) return false;
  const row = await ctx.db
    .query("adminUsers")
    .withIndex("by_profile", (q) => q.eq("profileId", viewer._id))
    .unique();
  return row !== null;
}

async function requireAdmin(ctx: QueryCtx) {
  if (!(await isAdmin(ctx))) deny("Not authorized");
}

export const amIAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => await isAdmin(ctx),
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
    if (!existing) await ctx.db.insert("adminUsers", { profileId: p._id });
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

    if (promoteReserved) {
      // One batch per call keeps the transaction small; re-run as needed.
      const batch = await ctx.db
        .query("profiles")
        .withIndex("by_accessLevel", (q) => q.eq("accessLevel", "reserved"))
        .take(1000);
      for (const p of batch) await ctx.db.patch(p._id, { accessLevel: "full" });
    }
    return null;
  },
});
