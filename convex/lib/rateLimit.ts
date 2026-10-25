import { DAY, HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { deny } from "./access";

/**
 * Per-account write limits (the @convex-dev/rate-limiter component). Better
 * Auth already limits sign-up/sign-in/reset per IP; these cover the app's own
 * mutations so one account can't loop posts, comments, likes, follows,
 * invites, or uploads. Token buckets: `rate` per `period` sustained, with up
 * to `capacity` in a burst. Generous for people, tight for scripts.
 *
 * Queries can't be limited this way (they can't write), so public queries
 * stay cheap single-index lookups instead — see docs/SECURITY.md.
 */
const LIMITS = {
  post: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  comment: { kind: "token bucket", rate: 120, period: HOUR, capacity: 20 },
  edit: { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  like: { kind: "token bucket", rate: 300, period: HOUR, capacity: 60 },
  follow: { kind: "token bucket", rate: 100, period: HOUR, capacity: 30 },
  invite: { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  createCommunity: { kind: "token bucket", rate: 10, period: DAY, capacity: 3 },
  upload: { kind: "token bucket", rate: 60, period: HOUR, capacity: 20 },
  profile: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
} as const;

export const rateLimiter = new RateLimiter(components.rateLimiter, LIMITS);

export type RateLimitName = keyof typeof LIMITS;

function wait(ms: number) {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "a minute";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "an hour" : `${hours} hours`;
}

/**
 * Spend one unit of `name` for this account, or deny with a user-safe message.
 * A denied (or otherwise failing) mutation rolls back, so the unit is only
 * spent when the write actually happens.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  name: RateLimitName,
  profileId: Id<"profiles">
) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key: profileId });
  if (!ok) deny(`You're doing that too often. Try again in ${wait(retryAfter ?? 0)}.`);
}
