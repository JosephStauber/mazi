import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireFullAccess } from "./lib/access";
import { toProfileListItem } from "./lib/dto";
import { profileListItemV } from "./lib/returns";

/**
 * People + communities search. Uses Convex full-text search indexes (word and
 * prefix matching on the last term), plus an exact-prefix pass on handles so
 * "jo" finds "joe_smith".
 */
export const all = query({
  args: { q: v.string() },
  returns: v.object({
    users: v.array(profileListItemV),
    communities: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
        description: v.union(v.string(), v.null()),
        privacy_type: v.union(v.literal("public"), v.literal("invite_only")),
      })
    ),
  }),
  handler: async (ctx, { q }) => {
    await requireFullAccess(ctx);
    const term = q.trim().slice(0, 64);
    if (term.length < 2) return { users: [], communities: [] };

    const lower = term.toLowerCase();
    const [prefixUsers, textUsers, communities] = await Promise.all([
      /^[a-z0-9_]+$/.test(lower)
        ? ctx.db
            .query("profiles")
            .withIndex("by_usernameLower", (x) =>
              x.gte("usernameLower", lower).lt("usernameLower", lower + "￿")
            )
            .take(20)
        : Promise.resolve([]),
      ctx.db
        .query("profiles")
        .withSearchIndex("search_username", (x) => x.search("username", term))
        .take(20),
      ctx.db
        .query("communities")
        .withSearchIndex("search_name", (x) => x.search("name", term))
        .take(20),
    ]);

    const seen = new Set<string>();
    const users = [...prefixUsers, ...textUsers]
      .filter((p) => p.accessLevel === "full" && !seen.has(p._id) && seen.add(p._id))
      .slice(0, 20);

    return {
      users: await Promise.all(users.map((u) => toProfileListItem(ctx, u))),
      communities: communities.map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        privacy_type: c.privacyType,
      })),
    };
  },
});
