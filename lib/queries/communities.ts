import { createClient } from "@/lib/supabase/server";
import type {
  CommunityWithMeta,
  CommunityMemberWithProfile,
  PostWithAuthor,
} from "@/lib/types/database";

export async function getCommunities(
  userId: string
): Promise<CommunityWithMeta[]> {
  const supabase = await createClient();

  const { data: communities } = await supabase
    .from("communities")
    .select("*")
    .order("created_at", { ascending: false });

  if (!communities) return [];

  const communityIds = communities.map((c) => c.id);

  const [{ data: membersData }, { data: userMemberships }] = await Promise.all([
    supabase
      .from("community_members")
      .select("community_id")
      .in("community_id", communityIds),
    supabase
      .from("community_members")
      .select("community_id, role")
      .in("community_id", communityIds)
      .eq("user_id", userId),
  ]);

  const countMap: Record<string, number> = {};
  (membersData ?? []).forEach((m: { community_id: string }) => {
    countMap[m.community_id] = (countMap[m.community_id] || 0) + 1;
  });

  const memberMap: Record<string, string> = {};
  (userMemberships ?? []).forEach(
    (m: { community_id: string; role: string }) => {
      memberMap[m.community_id] = m.role;
    }
  );

  return communities.map((c) => ({
    ...c,
    members_count: countMap[c.id] || 0,
    is_member: !!memberMap[c.id],
    role: (memberMap[c.id] as CommunityWithMeta["role"]) ?? null,
  }));
}

export async function getCommunityBySlug(
  slug: string,
  userId: string
): Promise<CommunityWithMeta | null> {
  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!community) return null;

  const [{ count }, { data: membership }] = await Promise.all([
    supabase
      .from("community_members")
      .select("*", { count: "exact", head: true })
      .eq("community_id", community.id),
    supabase
      .from("community_members")
      .select("role")
      .eq("community_id", community.id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    ...community,
    members_count: count ?? 0,
    is_member: !!membership,
    role: (membership?.role as CommunityWithMeta["role"]) ?? null,
  };
}

export async function getCommunityMembers(
  communityId: string
): Promise<CommunityMemberWithProfile[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("community_members")
    .select(`*, profile:profiles!user_id(*)`)
    .eq("community_id", communityId)
    .order("created_at", { ascending: true });

  return (data as CommunityMemberWithProfile[]) ?? [];
}

export async function getCommunityPosts(
  communityId: string,
  currentUserId: string
): Promise<PostWithAuthor[]> {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `*, author:profiles!author_id(*), community:communities!community_id(id, name, slug)`
    )
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (!posts) return [];

  const postIds = posts.map((p) => p.id);
  if (postIds.length === 0) return posts as PostWithAuthor[];

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
  })) as PostWithAuthor[];
}
