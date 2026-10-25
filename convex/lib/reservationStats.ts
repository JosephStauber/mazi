import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Running totals behind the admin reservation dashboard. The dashboard used to
 * recompute everything per request by joining every reservation to its profile
 * and auth user, which breaks Convex's per-query read limits at ~2,000 rows.
 * Instead, each event that changes a number updates the singleton
 * `reservationStats` row in the same transaction:
 *
 *  - signup (reservation created)         → `applyReservation(+1)`
 *  - account erased (reservation deleted) → `applyReservation(-1)`
 *  - email verified                       → `setReservationFlag("emailConfirmed")`
 *  - bio/avatar set or cleared            → `syncReservationCustomized`
 *
 * `admin:rebuildReservationStats` recomputes everything from the rows (backfill
 * and repair).
 */

export type StatsDoc = Omit<Doc<"reservationStats">, "_id" | "_creationTime">;

const KEY = "singleton";
const DAY = 24 * 60 * 60 * 1000;
/** Daily signup counts older than this are dropped (the chart shows 30). */
const KEEP_DAYS = 60;

export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function emptyStats(): StatsDoc {
  return {
    key: KEY,
    total: 0,
    confirmed: 0,
    customized: 0,
    referred: 0,
    sumMinutes: 0,
    minutes: {},
    reasons: {},
    daily: {},
  };
}

function bumpKey(rec: Record<string, number>, key: string, delta: number) {
  const next = (rec[key] ?? 0) + delta;
  if (next > 0) rec[key] = next;
  else delete rec[key];
}

type StatsRow = Pick<
  Doc<"reservations">,
  "_creationTime" | "reasons" | "dailySocialMinutes" | "referredBy" | "emailConfirmed" | "customized"
>;

/** Add (`sign` 1) or remove (`sign` -1) one reservation's contribution, in place. */
export function accumulate(s: StatsDoc, row: StatsRow, sign: 1 | -1) {
  s.total = Math.max(0, s.total + sign);
  if (row.emailConfirmed) s.confirmed = Math.max(0, s.confirmed + sign);
  if (row.customized) s.customized = Math.max(0, s.customized + sign);
  if (row.referredBy) s.referred = Math.max(0, s.referred + sign);
  if (typeof row.dailySocialMinutes === "number") {
    s.sumMinutes = Math.max(0, s.sumMinutes + sign * row.dailySocialMinutes);
    bumpKey(s.minutes, String(row.dailySocialMinutes), sign);
  }
  for (const reason of row.reasons) bumpKey(s.reasons, reason, sign);
  bumpKey(s.daily, dayKey(row._creationTime), sign);
}

function pruneDaily(s: StatsDoc, now: number) {
  const cutoff = dayKey(now - KEEP_DAYS * DAY);
  for (const day of Object.keys(s.daily)) if (day < cutoff) delete s.daily[day];
}

export async function readStats(ctx: QueryCtx) {
  return await ctx.db
    .query("reservationStats")
    .withIndex("by_key", (q) => q.eq("key", KEY))
    .unique();
}

/** Load, change, and write back the singleton (creating it on first use). */
export async function updateStats(ctx: MutationCtx, change: (s: StatsDoc) => void) {
  const existing = await readStats(ctx);
  const s: StatsDoc = existing
    ? {
        key: KEY,
        total: existing.total,
        confirmed: existing.confirmed,
        customized: existing.customized,
        referred: existing.referred,
        sumMinutes: existing.sumMinutes,
        minutes: { ...existing.minutes },
        reasons: { ...existing.reasons },
        daily: { ...existing.daily },
      }
    : emptyStats();
  change(s);
  pruneDaily(s, Date.now());
  if (existing) await ctx.db.replace(existing._id, s);
  else await ctx.db.insert("reservationStats", s);
}

export async function applyReservation(ctx: MutationCtx, row: StatsRow, sign: 1 | -1) {
  await updateStats(ctx, (s) => accumulate(s, row, sign));
}

/** Add `delta` to a referrer's `referralCount` (by referral code). */
export async function bumpReferralCount(ctx: MutationCtx, referralCode: string, delta: number) {
  const referrer = await ctx.db
    .query("reservations")
    .withIndex("by_referralCode", (q) => q.eq("referralCode", referralCode))
    .first();
  if (!referrer) return;
  await ctx.db.patch(referrer._id, {
    referralCount: Math.max(0, (referrer.referralCount ?? 0) + delta),
  });
}

/** Set a boolean flag on a profile's reservation and keep its counter right. */
export async function setReservationFlag(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  flag: "emailConfirmed" | "customized",
  value: boolean
) {
  const reservation = await ctx.db
    .query("reservations")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .unique();
  if (!reservation || !!reservation[flag] === value) return;
  await ctx.db.patch(reservation._id, { [flag]: value });
  const field = flag === "emailConfirmed" ? "confirmed" : "customized";
  await updateStats(ctx, (s) => {
    s[field] = Math.max(0, s[field] + (value ? 1 : -1));
  });
}

/** "Customized" = the profile has a bio or an avatar. Call after changing either. */
export async function syncReservationCustomized(ctx: MutationCtx, profileId: Id<"profiles">) {
  const profile = await ctx.db.get(profileId);
  if (!profile) return;
  await setReservationFlag(ctx, profileId, "customized", !!(profile.bio || profile.avatarId));
}
