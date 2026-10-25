import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  CommentWithAuthor,
  CommunityWithMeta,
  Profile,
  ProfileListItem,
  ProfileRef,
  PostWithAuthor,
} from "../../lib/types/database";
import type { Viewer } from "./access";

/**
 * Shape Convex documents into the DTOs the UI renders (`lib/types/database.ts`).
 * Keeping the wire shape stable (snake_case, ISO timestamps, `id`) means the
 * components didn't need to learn Convex's document format.
 */

export const iso = (t: number) => new Date(t).toISOString();

export async function avatarUrl(
  ctx: QueryCtx,
  p: Doc<"profiles">
): Promise<string | null> {
  return p.avatarId ? await ctx.storage.getUrl(p.avatarId) : null;
}

/** Post images are served through `/api/images/[postId]`, which re-checks access. */
export function postImageUrl(post: Doc<"posts">): string | null {
  return post.imageId ? `/api/images/${post._id}` : null;
}

export async function toProfileRef(
  ctx: QueryCtx,
  p: Doc<"profiles">
): Promise<ProfileRef> {
  return { id: p._id, username: p.username, avatar_url: await avatarUrl(ctx, p) };
}

export async function toProfileListItem(
  ctx: QueryCtx,
  p: Doc<"profiles">
): Promise<ProfileListItem> {
  return { ...(await toProfileRef(ctx, p)), bio: p.bio ?? null };
}

export async function toProfile(
  ctx: QueryCtx,
  p: Doc<"profiles">
): Promise<Profile> {
  return {
    id: p._id,
    username: p.username,
    bio: p.bio ?? null,
    avatar_url: await avatarUrl(ctx, p),
    created_at: iso(p._creationTime),
    access_level: p.accessLevel,
  };
}

/** Per-request memo so a page of posts by one author loads the author once. */
export function refLoader(ctx: QueryCtx) {
  const cache = new Map<string, Promise<ProfileRef | null>>();
  return (id: Id<"profiles">) => {
    let hit = cache.get(id);
    if (!hit) {
      hit = ctx.db.get(id).then((p) => (p ? toProfileRef(ctx, p) : null));
      cache.set(id, hit);
    }
    return hit;
  };
}

const DELETED_AUTHOR: ProfileRef = { id: "", username: "deleted", avatar_url: null };

export async function toPostDTO(
  ctx: QueryCtx,
  viewer: Viewer,
  post: Doc<"posts">,
  loadRef = refLoader(ctx)
): Promise<PostWithAuthor> {
  const [author, community, like] = await Promise.all([
    loadRef(post.authorId),
    post.communityId ? ctx.db.get(post.communityId) : Promise.resolve(null),
    ctx.db
      .query("likes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", post._id).eq("userId", viewer._id)
      )
      .unique(),
  ]);
  return {
    id: post._id,
    author_id: post.authorId,
    content: post.content,
    image_url: postImageUrl(post),
    community_id: post.communityId ?? null,
    created_at: iso(post._creationTime),
    author: author ?? DELETED_AUTHOR,
    community: community
      ? { id: community._id, name: community.name, slug: community.slug }
      : null,
    likes_count: post.likeCount,
    comments_count: post.commentCount,
    liked_by_user: like !== null,
  };
}

export async function toCommentDTO(
  ctx: QueryCtx,
  c: Doc<"comments">,
  loadRef = refLoader(ctx)
): Promise<CommentWithAuthor> {
  return {
    id: c._id,
    post_id: c.postId,
    author_id: c.authorId,
    content: c.content,
    parent_id: c.parentId ?? null,
    created_at: iso(c._creationTime),
    author: (await loadRef(c.authorId)) ?? DELETED_AUTHOR,
  };
}

export async function toCommunityDTO(
  ctx: QueryCtx,
  viewer: Viewer,
  c: Doc<"communities">
): Promise<CommunityWithMeta> {
  const membership = await ctx.db
    .query("communityMembers")
    .withIndex("by_community_user", (q) =>
      q.eq("communityId", c._id).eq("userId", viewer._id)
    )
    .unique();
  return {
    id: c._id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    creator_id: c.creatorId,
    privacy_type: c.privacyType,
    created_at: iso(c._creationTime),
    members_count: c.memberCount,
    is_member: membership !== null,
    role: membership?.role ?? null,
  };
}
