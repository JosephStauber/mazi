import { createClient } from "@/lib/supabase/server";
import { enrichPosts } from "@/lib/queries/feed";
import type {
  Page,
  PostWithAuthor,
  CommentWithAuthor,
} from "@/lib/types/database";
import { decodeCursor, keysetFilter, pageFromRows } from "@/lib/utils/cursor";

export const PROFILE_POSTS_PAGE_SIZE = 15;
/** Root comments per page. Each root's direct replies load with it. */
export const COMMENT_ROOTS_PAGE_SIZE = 10;

const POST_SELECT = `*, author:profiles!author_id(id, username, avatar_url), community:communities!community_id(id, name, slug), likes(count), comments(count)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowKey = (r: any) => ({ created_at: r.created_at, id: r.id });

export async function getPostsByUser(
  userId: string,
  currentUserId: string,
  cursor?: string | null
): Promise<Page<PostWithAuthor>> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PROFILE_POSTS_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) query = query.or(keysetFilter(decoded, "desc"));

  const { data: rows } = await query;
  if (!rows) return { items: [], nextCursor: null };

  const { pageRows, nextCursor } = pageFromRows(
    rows,
    PROFILE_POSTS_PAGE_SIZE,
    rowKey
  );
  const items = await enrichPosts(supabase, pageRows, currentUserId);
  return { items, nextCursor };
}

export async function getPostCountByUser(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("author_id", userId);
  return count ?? 0;
}

export async function getPost(
  postId: string,
  currentUserId: string
): Promise<PostWithAuthor | null> {
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .single();

  if (!post) return null;

  const enriched = await enrichPosts(supabase, [post], currentUserId);
  return enriched[0] ?? null;
}

/**
 * A page of a post's comments. Pagination is by root comment (ascending,
 * oldest first); each returned page also carries every direct reply of the
 * roots on that page, so threads stay intact across page boundaries. The
 * client re-threads the flat `items` list. `nextCursor` keys on the last root.
 */
export async function getPostComments(
  postId: string,
  cursor?: string | null
): Promise<Page<CommentWithAuthor>> {
  const supabase = await createClient();

  let rootsQuery = supabase
    .from("comments")
    .select(`*, author:profiles!author_id(id, username, avatar_url)`)
    .eq("post_id", postId)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(COMMENT_ROOTS_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) rootsQuery = rootsQuery.or(keysetFilter(decoded, "asc"));

  const { data: rootRows } = await rootsQuery;
  if (!rootRows) return { items: [], nextCursor: null };

  const { pageRows: roots, nextCursor } = pageFromRows(
    rootRows,
    COMMENT_ROOTS_PAGE_SIZE,
    rowKey
  );

  let replies: CommentWithAuthor[] = [];
  if (roots.length > 0) {
    const rootIds = roots.map((r) => r.id);
    const { data: replyRows } = await supabase
      .from("comments")
      .select(`*, author:profiles!author_id(id, username, avatar_url)`)
      .eq("post_id", postId)
      .in("parent_id", rootIds)
      .order("created_at", { ascending: true });
    replies = (replyRows as CommentWithAuthor[]) ?? [];
  }

  return {
    items: [...(roots as CommentWithAuthor[]), ...replies],
    nextCursor,
  };
}
