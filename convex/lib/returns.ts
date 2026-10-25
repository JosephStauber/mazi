import { v, type Validator } from "convex/values";

/**
 * Return validators for the DTOs in `lib/types/database.ts`. Declaring them on
 * every public function means Convex rejects any response that would leak a
 * field the UI doesn't need (e.g. a raw document with `authUserId`).
 */

export const nullable = <T extends Validator<unknown, "required", string>>(t: T) =>
  v.union(t, v.null());

export const profileRefV = v.object({
  id: v.string(),
  username: v.string(),
  avatar_url: nullable(v.string()),
});

export const profileListItemV = v.object({
  id: v.string(),
  username: v.string(),
  avatar_url: nullable(v.string()),
  bio: nullable(v.string()),
});

export const profileV = v.object({
  id: v.string(),
  username: v.string(),
  bio: nullable(v.string()),
  avatar_url: nullable(v.string()),
  created_at: v.string(),
  access_level: v.union(v.literal("reserved"), v.literal("full")),
});

export const communityRefV = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
});

export const postV = v.object({
  id: v.string(),
  author_id: v.string(),
  content: v.string(),
  image_url: nullable(v.string()),
  community_id: nullable(v.string()),
  created_at: v.string(),
  author: profileRefV,
  community: nullable(communityRefV),
  likes_count: v.number(),
  comments_count: v.number(),
  liked_by_user: v.boolean(),
});

export const commentV = v.object({
  id: v.string(),
  post_id: v.string(),
  author_id: v.string(),
  content: v.string(),
  parent_id: nullable(v.string()),
  created_at: v.string(),
  author: profileRefV,
});

export const communityRoleV = v.union(
  v.literal("member"),
  v.literal("moderator"),
  v.literal("creator")
);

export const communityV = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
  description: nullable(v.string()),
  creator_id: v.string(),
  privacy_type: v.union(v.literal("public"), v.literal("invite_only")),
  created_at: v.string(),
  members_count: v.number(),
  is_member: v.boolean(),
  role: nullable(communityRoleV),
});

/** Shape of a `.paginate()` result with mapped items. */
export const paginated = <T extends Validator<unknown, "required", string>>(item: T) =>
  v.object({
    page: v.array(item),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())
    ),
  });
