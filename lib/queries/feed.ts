import { createClient } from "@/lib/supabase/server";
import type { Page, PostWithAuthor } from "@/lib/types/database";
import { decodeCursor, keysetFilter, pageFromRows } from "@/lib/utils/cursor";

export const FEED_PAGE_SIZE = 15;

const POST_SELECT = `*, author:profiles!author_id(id, username, avatar_url), community:communities!community_id(id, name, slug), likes(count), comments(count)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const postKey = (p: any) => ({ created_at: p.created_at, id: p.id });

export async function getFollowingFeed(
  userId: string,
  cursor?: string | null
): Promise<Page<PostWithAuthor>> {
  const supabase = await createClient();

  const { data: followsData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = (followsData ?? []).map((f) => f.following_id);
  if (followingIds.length === 0) return { items: [], nextCursor: null };

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .in("author_id", followingIds)
    .is("community_id", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) query = query.or(keysetFilter(decoded, "desc"));

  const { data: rows } = await query;
  if (!rows) return { items: [], nextCursor: null };

  const { pageRows, nextCursor } = pageFromRows(rows, FEED_PAGE_SIZE, postKey);
  const items = await enrichPosts(supabase, pageRows, userId);
  return { items, nextCursor };
}

/**
 * Posts in communities the user belongs to.
 * @param filterCommunityId When set, only that community (membership is verified);
 *   otherwise all member communities.
 * @param memberIds Pre-fetched member community ids for the unfiltered feed — pass
 *   these when the caller already read them (e.g. the communities page just called
 *   `getCommunities`) to avoid a second `community_members` read on the same request.
 */
export async function getCommunitiesFeed(
  userId: string,
  filterCommunityId?: string | null,
  cursor?: string | null,
  memberIds?: string[]
): Promise<Page<PostWithAuthor>> {
  const supabase = await createClient();

  let communityIds: string[];

  if (filterCommunityId) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .eq("community_id", filterCommunityId)
      .maybeSingle();

    if (!membership) return { items: [], nextCursor: null };
    communityIds = [filterCommunityId];
  } else if (memberIds) {
    communityIds = memberIds;
  } else {
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId);

    communityIds = (memberships ?? []).map((m) => m.community_id);
  }

  if (communityIds.length === 0) return { items: [], nextCursor: null };

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .in("community_id", communityIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) query = query.or(keysetFilter(decoded, "desc"));

  const { data: rows } = await query;
  if (!rows) return { items: [], nextCursor: null };

  const { pageRows, nextCursor } = pageFromRows(rows, FEED_PAGE_SIZE, postKey);
  const items = await enrichPosts(supabase, pageRows, userId);
  return { items, nextCursor };
}

/**
 * Attach engagement metadata to raw post rows. Total like/comment counts are
 * computed in the database via embedded aggregates — callers must include
 * `likes(count), comments(count)` in their select — so we only need one extra
 * query here for the caller's own likes (to set `liked_by_user`).
 */
export async function enrichPosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  posts: any[],
  currentUserId: string
): Promise<PostWithAuthor[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  const { data: userLikes } = await supabase
    .from("likes")
    .select("post_id")
    .in("post_id", postIds)
    .eq("user_id", currentUserId);

  const userLikesSet = new Set<string>();
  (userLikes ?? []).forEach((l: { post_id: string }) => {
    userLikesSet.add(l.post_id);
  });

  // Embedded aggregates arrive as `likes: [{ count: n }]`; strip them from the
  // returned object and surface flat counts instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return posts.map(({ likes, comments, ...post }: any) => ({
    ...post,
    likes_count: Array.isArray(likes) ? likes[0]?.count ?? 0 : 0,
    comments_count: Array.isArray(comments) ? comments[0]?.count ?? 0 : 0,
    liked_by_user: userLikesSet.has(post.id),
  }));
}
