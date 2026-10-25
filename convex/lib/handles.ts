import type { QueryCtx } from "../_generated/server";

/**
 * Handles nobody may take, before any admin-added ones. Exact matches only —
 * add substring rules (slurs) through the admin Handles page.
 */
export const BUILT_IN_BLOCKED_HANDLES = [
  "admin",
  "administrator",
  "mazi",
  "mazi_social",
  "support",
  "help",
  "official",
  "staff",
  "team",
  "moderator",
  "mod",
  "security",
  "system",
  "root",
  "abuse",
  "legal",
  "privacy",
  "everyone",
] as const;

/** At most this many admin rules are checked; the list is meant to stay short. */
const MAX_RULES = 1000;

/** Whether a handle is reserved (built-in list or an admin `blockedHandles` rule). */
export async function isHandleBlocked(ctx: QueryCtx, handle: string): Promise<boolean> {
  const lower = handle.trim().toLowerCase();
  if ((BUILT_IN_BLOCKED_HANDLES as readonly string[]).includes(lower)) return true;
  const rules = await ctx.db.query("blockedHandles").take(MAX_RULES);
  return rules.some((r) =>
    r.match === "exact" ? r.handleLower === lower : lower.includes(r.handleLower)
  );
}
