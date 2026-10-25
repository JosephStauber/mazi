import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  deny,
  getAdminRole,
  getViewer,
  isSuspended,
  requireAdmin,
  requireOwner,
} from "./lib/access";
import { avatarUrl, iso } from "./lib/dto";
import { audit, liftSuspension, notifyByEmail, suspendProfile } from "./lib/moderation";
import { nullable, paginated } from "./lib/returns";
import { randomToken } from "./lib/signup";
import { parseOrDeny } from "./lib/validate";
import { adminAction, adminRole, appealStatus, signupMode } from "./schema";
import { authComponent } from "./auth";
import {
  adminNoteSchema,
  SUSPEND_DURATIONS,
  suspendReasonSchema,
} from "../lib/validators/admin";

/** Rows the reservation list returns (mirrors RESERVATION_LIST_LIMIT). */
const LIST_LIMIT = 2000;

/** The caller's admin role, or null. Drives the admin layout gate + nav. */
export const myRole = query({
  args: {},
  returns: v.union(adminRole, v.null()),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer || isSuspended(viewer)) return null;
    return await getAdminRole(ctx, viewer._id);
  },
});

const DAY = 24 * 60 * 60 * 1000;

/** New accounts this active within a day get flagged for a look (counters only). */
const NEW_ACCOUNT_POSTS = 20;
const NEW_ACCOUNT_FOLLOWING = 100;

const adminUserV = v.object({
  id: v.string(),
  username: v.string(),
  avatar_url: nullable(v.string()),
  access_level: v.union(v.literal("reserved"), v.literal("full")),
  created_at: v.string(),
  post_count: v.number(),
  follower_count: v.number(),
  following_count: v.number(),
  admin_role: nullable(adminRole),
  suspended_at: nullable(v.string()),
  suspended_until: nullable(v.string()),
  suspended_reason: nullable(v.string()),
  /** New (<24h) and unusually active — worth a look, not proof of anything. */
  flagged: v.boolean(),
});

async function toAdminUser(ctx: QueryCtx, p: Doc<"profiles">) {
  const isNew = Date.now() - p._creationTime < DAY;
  return {
    id: p._id,
    username: p.username,
    avatar_url: await avatarUrl(ctx, p),
    access_level: p.accessLevel,
    created_at: iso(p._creationTime),
    post_count: p.postCount,
    follower_count: p.followerCount,
    following_count: p.followingCount,
    admin_role: await getAdminRole(ctx, p._id),
    suspended_at: p.suspendedAt !== undefined ? iso(p.suspendedAt) : null,
    suspended_until: p.suspendedUntil !== undefined ? iso(p.suspendedUntil) : null,
    suspended_reason: p.suspendedReason ?? null,
    flagged:
      isNew &&
      (p.postCount >= NEW_ACCOUNT_POSTS || p.followingCount >= NEW_ACCOUNT_FOLLOWING),
  };
}

/** Every account newest first, only suspended ones, or only last-24h signups. No emails. */
export const users = query({
  args: {
    filter: v.union(v.literal("all"), v.literal("new"), v.literal("suspended")),
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
        : filter === "new"
          ? await ctx.db
              .query("profiles")
              .withIndex("by_creation_time", (q) => q.gt("_creationTime", Date.now() - DAY))
              .order("desc")
              .paginate(paginationOpts)
          : await ctx.db.query("profiles").order("desc").paginate(paginationOpts);
    const page = [];
    for (const p of result.page) page.push(await toAdminUser(ctx, p));
    return { ...result, page };
  },
});

/** Case-insensitive handle-prefix lookup. */
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

const auditEntryV = v.object({
  id: v.string(),
  action: adminAction,
  /** null = CLI/dashboard run, the system (expiry), or an admin who has since erased their account. */
  actor_username: nullable(v.string()),
  actor_id: nullable(v.string()),
  target_username: nullable(v.string()),
  /** null once the target erased their account. */
  target_id: nullable(v.string()),
  reason: nullable(v.string()),
  details: nullable(v.string()),
  created_at: v.string(),
});

async function toAuditEntry(ctx: QueryCtx, a: Doc<"adminActions">) {
  const actor = a.actorId ? await ctx.db.get(a.actorId) : null;
  return {
    id: a._id,
    action: a.action,
    actor_username: actor?.username ?? null,
    actor_id: actor?._id ?? null,
    target_username: a.targetUsername ?? null,
    target_id: a.targetId ?? null,
    reason: a.reason ?? null,
    details: a.details ?? null,
    created_at: iso(a._creationTime),
  };
}

/** Everything the user page shows. Email is not included — see `revealEmail`. */
export const user = query({
  args: { profileId: v.id("profiles") },
  returns: v.union(
    v.null(),
    v.object({
      user: adminUserV,
      bio: nullable(v.string()),
      communities: v.array(
        v.object({ id: v.string(), name: v.string(), slug: v.string(), member_count: v.number() })
      ),
      history: v.array(auditEntryV),
      notes: v.array(
        v.object({
          id: v.string(),
          author_username: nullable(v.string()),
          is_mine: v.boolean(),
          body: v.string(),
          created_at: v.string(),
        })
      ),
      appeals: v.array(
        v.object({
          id: v.string(),
          status: appealStatus,
          body: v.string(),
          response: nullable(v.string()),
          created_at: v.string(),
        })
      ),
    })
  ),
  handler: async (ctx, { profileId }) => {
    const admin = await requireAdmin(ctx);
    const p = await ctx.db.get(profileId);
    if (!p) return null;

    const [communities, history, notes, appeals] = await Promise.all([
      ctx.db.query("communities").withIndex("by_creator", (q) => q.eq("creatorId", p._id)).take(50),
      ctx.db
        .query("adminActions")
        .withIndex("by_target", (q) => q.eq("targetId", p._id))
        .order("desc")
        .take(50),
      ctx.db
        .query("adminNotes")
        .withIndex("by_target", (q) => q.eq("targetId", p._id))
        .order("desc")
        .take(100),
      ctx.db
        .query("appeals")
        .withIndex("by_profile", (q) => q.eq("profileId", p._id))
        .order("desc")
        .take(20),
    ]);

    const noteOut = [];
    for (const n of notes) {
      const author = n.authorId ? await ctx.db.get(n.authorId) : null;
      noteOut.push({
        id: n._id,
        author_username: author?.username ?? null,
        is_mine: n.authorId === admin._id,
        body: n.body,
        created_at: iso(n._creationTime),
      });
    }
    const historyOut = [];
    for (const a of history) historyOut.push(await toAuditEntry(ctx, a));

    return {
      user: await toAdminUser(ctx, p),
      bio: p.bio ?? null,
      communities: communities.map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        member_count: c.memberCount,
      })),
      history: historyOut,
      notes: noteOut,
      appeals: appeals.map((a) => ({
        id: a._id,
        status: a.status,
        body: a.body,
        response: a.response ?? null,
        created_at: iso(a._creationTime),
      })),
    };
  },
});

/**
 * Show one account's email to an owner. A mutation (not a query) so every
 * look writes an audit row.
 */
export const revealEmail = mutation({
  args: { profileId: v.id("profiles") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { profileId }) => {
    const admin = await requireOwner(ctx);
    const target = await ctx.db.get(profileId);
    if (!target) deny("User not found");
    const user = await authComponent.getAnyUserById(ctx, target.authUserId);
    await audit(ctx, { actorId: admin._id, action: "reveal_email", target });
    return user?.email ?? null;
  },
});

export const addNote = mutation({
  args: { profileId: v.id("profiles"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, { profileId, body }) => {
    const admin = await requireAdmin(ctx);
    if (!(await ctx.db.get(profileId))) deny("User not found");
    const text = parseOrDeny(adminNoteSchema, body);
    await ctx.db.insert("adminNotes", { targetId: profileId, authorId: admin._id, body: text });
    return null;
  },
});

/** Delete a note: its author, or any owner. */
export const deleteNote = mutation({
  args: { noteId: v.id("adminNotes") },
  returns: v.null(),
  handler: async (ctx, { noteId }) => {
    const admin = await requireAdmin(ctx);
    const note = await ctx.db.get(noteId);
    if (!note) return null;
    if (note.authorId !== admin._id && (await getAdminRole(ctx, admin._id)) !== "owner") {
      deny("Only the author or an owner can delete this note");
    }
    await ctx.db.delete(noteId);
    return null;
  },
});

const durationV = v.union(v.literal("1d"), v.literal("7d"), v.literal("30d"), v.literal("permanent"));

/**
 * Lock an account out (`requireViewer` enforces it everywhere), sign it out,
 * and email the reason. Admins can't be suspended.
 */
export const suspendUser = mutation({
  args: { profileId: v.id("profiles"), reason: v.string(), duration: durationV },
  returns: v.null(),
  handler: async (ctx, { profileId, reason, duration }) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(profileId);
    if (!target) deny("User not found");
    if (target._id === admin._id) deny("You can't suspend yourself");
    if (await getAdminRole(ctx, target._id)) deny("Admins can't be suspended");
    if (isSuspended(target)) deny("Already suspended");
    const why = parseOrDeny(suspendReasonSchema, reason);
    const { ms, label } = SUSPEND_DURATIONS[duration];

    await suspendProfile(ctx, {
      target,
      actorId: admin._id,
      reason: why,
      until: ms === null ? null : Date.now() + ms,
      durationLabel: label,
    });
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
    await liftSuspension(ctx, { target, actorId: admin._id, via: "admin" });
    return null;
  },
});

/** Cron: lift timed suspensions whose end has passed. */
export const expireSuspensions = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.db
      .query("profiles")
      .withIndex("by_suspendedUntil", (q) => q.gt("suspendedUntil", 0).lte("suspendedUntil", Date.now()))
      .take(100);
    for (const target of due) await liftSuspension(ctx, { target, via: "expired" });
    return null;
  },
});

/**
 * Clear an offensive bio/avatar or force a new handle without suspending.
 * The user is emailed the reason.
 */
export const resetProfile = mutation({
  args: {
    profileId: v.id("profiles"),
    bio: v.boolean(),
    avatar: v.boolean(),
    username: v.boolean(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { profileId, bio, avatar, username, reason }) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(profileId);
    if (!target) deny("User not found");
    if (!bio && !avatar && !username) deny("Pick something to reset");
    const why = parseOrDeny(suspendReasonSchema, reason);

    const patch: Partial<Doc<"profiles">> = {};
    const done: string[] = [];
    if (bio && target.bio) {
      patch.bio = undefined;
      done.push("bio");
    }
    if (avatar && target.avatarId) {
      await ctx.storage.delete(target.avatarId);
      patch.avatarId = undefined;
      done.push("avatar");
    }
    if (username) {
      let handle = `user_${randomToken(8)}`;
      while (
        await ctx.db
          .query("profiles")
          .withIndex("by_usernameLower", (q) => q.eq("usernameLower", handle.toLowerCase()))
          .first()
      ) {
        handle = `user_${randomToken(10)}`;
      }
      patch.username = handle;
      patch.usernameLower = handle.toLowerCase();
      done.push(`username (@${target.username} → @${handle})`);
    }
    if (done.length === 0) deny("Nothing to reset — those fields are already empty");

    await ctx.db.patch(target._id, patch);
    await notifyByEmail(ctx, target, "We changed part of your Mazi profile", [
      `Hi @${target.username},`,
      `Our team reset your profile ${done.map((d) => d.split(" ")[0]).join(", ")} because it broke the community guidelines.`,
      `Reason: ${why}`,
      ...(patch.username ? [`Your handle is now @${patch.username}. You can choose a new one in Settings.`] : []),
    ]);
    await audit(ctx, {
      actorId: admin._id,
      action: "reset_profile",
      target,
      reason: why,
      details: done.join(", "),
    });
    return null;
  },
});

/** The audit log, newest first, optionally narrowed to one action or one target. */
export const auditLog = query({
  args: {
    action: v.optional(adminAction),
    targetId: v.optional(v.id("profiles")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginated(auditEntryV),
  handler: async (ctx, { action, targetId, paginationOpts }) => {
    await requireAdmin(ctx);
    const query = targetId
      ? ctx.db
          .query("adminActions")
          .withIndex("by_target_action", (q) =>
            action ? q.eq("targetId", targetId).eq("action", action) : q.eq("targetId", targetId)
          )
      : action
        ? ctx.db.query("adminActions").withIndex("by_action", (q) => q.eq("action", action))
        : ctx.db.query("adminActions");
    const result = await query.order("desc").paginate(paginationOpts);
    const page = [];
    for (const a of result.page) page.push(await toAuditEntry(ctx, a));
    return { ...result, page };
  },
});

/** Up to 5000 entries for a CSV export (e.g. a DSA transparency report). Owners only. */
export const auditExport = query({
  args: { action: v.optional(adminAction) },
  returns: v.array(auditEntryV),
  handler: async (ctx, { action }) => {
    await requireOwner(ctx);
    const rows = await (action
      ? ctx.db.query("adminActions").withIndex("by_action", (q) => q.eq("action", action))
      : ctx.db.query("adminActions")
    )
      .order("desc")
      .take(5000);
    const out = [];
    for (const a of rows) out.push(await toAuditEntry(ctx, a));
    return out;
  },
});

/** Aggregate dashboard metrics. Owners only. */
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
    await requireOwner(ctx);
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
 * Per-signup rows **including email** — with `revealEmail`, the only paths
 * that expose emails to a client, and only to owners.
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
    await requireOwner(ctx);
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
 * Add an admin or change their role (privilege grant — run deliberately from
 * the CLI/dashboard). Role defaults to `owner`:
 *   npx convex run admin:grant '{"username": "you"}'
 *   npx convex run admin:grant '{"username": "helper", "role": "moderator"}'
 */
export const grant = internalMutation({
  args: { username: v.string(), role: v.optional(adminRole) },
  returns: v.null(),
  handler: async (ctx, { username, role = "owner" }) => {
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
      await ctx.db.insert("adminUsers", { profileId: p._id, role });
    } else if ((existing.role ?? "owner") !== role) {
      await ctx.db.patch(existing._id, { role });
    } else {
      return null;
    }
    await audit(ctx, { action: "grant_admin", target: p, details: role });
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
