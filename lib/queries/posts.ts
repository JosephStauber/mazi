import { createClient } from "@/lib/supabase/server";
import type { PostWithAuthor, CommentWithAuthor } from "@/lib/types/database";

export async function getPostsByUser(
  userId: string,
  currentUserId: string
): Promise<PostWithAuthor[]> {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `*, author:profiles!author_id(*), community:communities!community_id(id, name, slug)`
    )
    .eq("author_id", userId)
    .order("created_at", { ascending: false });

  if (!posts) return [];

  return await enrichPosts(supabase, posts, currentUserId);
}

export async function getPost(
  postId: string,
  currentUserId: string
): Promise<PostWithAuthor | null> {
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select(
      `*, author:profiles!author_id(*), community:communities!community_id(id, name, slug)`
    )
    .eq("id", postId)
    .single();

  if (!post) return null;

  const enriched = await enrichPosts(supabase, [post], currentUserId);
  return enriched[0] ?? null;
}

export async function getPostComments(
  postId: string
): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("comments")
    .select(`*, author:profiles!author_id(*)`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  return (data as CommentWithAuthor[]) ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichPosts(supabase: any, posts: any[], currentUserId: string): Promise<PostWithAuthor[]> {
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
