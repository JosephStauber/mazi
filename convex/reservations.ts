import { v } from "convex/values";
import { query } from "./_generated/server";
import { getViewer } from "./lib/access";

/**
 * The signed-in user's own reservation + how many confirmed signups used their
 * referral code. Owner-only; never exposes anyone else's reservation.
 */
export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ referral_code: v.string(), referral_count: v.number() })
  ),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    const reservation = await ctx.db
      .query("reservations")
      .withIndex("by_profile", (q) => q.eq("profileId", viewer._id))
      .unique();
    if (!reservation) return null;

    const referred = await ctx.db
      .query("reservations")
      .withIndex("by_referredBy", (q) => q.eq("referredBy", reservation.referralCode))
      .take(500);
    // Count only referrals that confirmed their email (as before).
    const confirmed = referred.filter((r) => r.emailConfirmed).length;
    return { referral_code: reservation.referralCode, referral_count: confirmed };
  },
});
