import { createClient } from "@/lib/supabase/server";
import type { PostWithAuthor } from "@/lib/types/database";

export async function getFollowingFeed(
  userId: string
): Promise<PostWithAuthor[]> {
  const supabase = await createClient();

  const { data: followsData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = (followsData ?? []).map((f) => f.following_id);

  if (followingIds.length === 0) return [];

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `*, author:profiles!author_id(*), community:communities!community_id(id, name, slug)`
    )
    .in("author_id", followingIds)
    .is("community_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!posts) return [];

  return await enrichPosts(supabase, posts, userId);
}

/**
 * Posts in communities the user belongs to.
 * @param filterCommunityId When set, only that community (must be a membership); otherwise all member communities.
 */
export async function getCommunitiesFeed(
  userId: string,
  filterCommunityId?: string | null
): Promise<PostWithAuthor[]> {
  const supabase = await createClient();

  let communityIds: string[];

  if (filterCommunityId) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .eq("community_id", filterCommunityId)
      .maybeSingle();

    if (!membership) return [];
    communityIds = [filterCommunityId];
  } else {
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId);

    communityIds = (memberships ?? []).map((m) => m.community_id);
  }

  if (communityIds.length === 0) return [];

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `*, author:profiles!author_id(*), community:communities!community_id(id, name, slug)`
    )
    .in("community_id", communityIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!posts) return [];

  return await enrichPosts(supabase, posts, userId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichPosts(supabase: any, posts: any[], currentUserId: string): Promise<PostWithAuthor[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  const [{ data: likesData }, { data: commentsData }, { data: userLikes }] =
    await Promise.all([
      supabase.from("likes").select("post_id").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds),
      supabase
        .from("likes")
        .select("post_id")
        .in("post_id", postIds)
        .eq("user_id", currentUserId),
    ]);

  const likesMap: Record<string, number> = {};
  const commentsMap: Record<string, number> = {};
  const userLikesSet = new Set<string>();

  (likesData ?? []).forEach((l: { post_id: string }) => {
    likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1;
  });
  (commentsData ?? []).forEach((c: { post_id: string }) => {
    commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1;
  });
  (userLikes ?? []).forEach((l: { post_id: string }) => {
    userLikesSet.add(l.post_id);
  });

  return posts.map((post) => ({
    ...post,
    likes_count: likesMap[post.id] || 0,
    comments_count: commentsMap[post.id] || 0,
    liked_by_user: userLikesSet.has(post.id),
  }));
}
