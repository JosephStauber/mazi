import { createClient } from "@/lib/supabase/server";
import { enrichPosts } from "@/lib/queries/feed";
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
